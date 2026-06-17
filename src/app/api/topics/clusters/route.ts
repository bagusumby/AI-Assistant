import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatCompletion } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

const CLASSIFY_PROMPT = `Kamu adalah analis data. Berikut adalah daftar pertanyaan dari pengguna.
Kelompokkan pertanyaan-pertanyaan ini ke dalam klaster/topik yang serupa.
Untuk setiap klaster, berikan:
- name: nama topik singkat (2-5 kata, Bahasa Indonesia)
- description: deskripsi 1 kalimat
- representative_question: 1 pertanyaan representatif yang paling mewakili klaster ini (buat kalimat pertanyaan baru yang natural, bukan copy dari daftar)
- questions: array index pertanyaan yang masuk klaster ini (0-based)

Aturan:
- Buat 3-15 klaster tergantung variasi pertanyaan
- Setiap pertanyaan HARUS masuk tepat 1 klaster
- Jika ada pertanyaan yang tidak cocok di mana-mana, masukkan ke klaster "Lainnya"
- representative_question harus natural dan bisa dijadikan "quick question" untuk pengguna baru

Return HANYA JSON array valid, tanpa penjelasan:
[{"name": "...", "description": "...", "representative_question": "...", "questions": [0, 1, 5]}]

Daftar pertanyaan:
`;

interface ClusterResult {
  name: string;
  description: string;
  representative_question?: string;
  questions: number[];
}

// GET: List clusters per bot
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType, botId: sessionBotId } = session.user as {
    role?: string;
    roleType?: string;
    botId?: string;
  };

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filterBotId = searchParams.get("botId");
  const clusterId = searchParams.get("clusterId");

  // If requesting items for a specific cluster
  if (clusterId) {
    const { data: items, error } = await supabaseAdmin
      .from("cluster_items")
      .select("id, question, user_id, session_id, message_created_at, created_at")
      .eq("cluster_id", clusterId)
      .order("message_created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with user names
    const userIds = [...new Set((items || []).map((q) => q.user_id).filter(Boolean))];
    let usersMap: Record<string, { name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from("users")
        .select("id, name, email")
        .in("id", userIds);
      if (usersData) {
        usersMap = Object.fromEntries(usersData.map((u) => [u.id, { name: u.name, email: u.email }]));
      }
    }

    const enriched = (items || []).map((q) => ({
      ...q,
      users: usersMap[q.user_id] || null,
    }));

    return NextResponse.json(enriched);
  }

  // List all clusters
  let query = supabaseAdmin
    .from("question_clusters")
    .select("id, name, description, question_count, sample_questions, representative_question, analyzed_at, created_at, ai_bot_id, ai_bots!question_clusters_ai_bot_id_fkey(id, name)")
    .order("question_count", { ascending: false });

  if (role !== "admin" && sessionBotId) {
    query = query.eq("ai_bot_id", sessionBotId);
  } else if (filterBotId) {
    query = query.eq("ai_bot_id", filterBotId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST: Run batch analysis - classify all user questions into clusters
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType } = session.user as { role?: string; roleType?: string };
  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { botId } = await req.json();

    if (!botId) {
      return NextResponse.json({ error: "Bot ID diperlukan" }, { status: 400 });
    }

    // Fetch all user messages for this bot (from chat_messages via chat_sessions)
    const { data: sessions } = await supabaseAdmin
      .from("chat_sessions")
      .select("id")
      .eq("ai_bot_id", botId);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: "Belum ada percakapan untuk bot ini" }, { status: 400 });
    }

    const sessionIds = sessions.map((s) => s.id);

    // Fetch user messages (limit to recent 200 for LLM context)
    const { data: messages } = await supabaseAdmin
      .from("chat_messages")
      .select("content, user_id, session_id, created_at")
      .in("session_id", sessionIds)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Belum ada pertanyaan user untuk bot ini" }, { status: 400 });
    }

    // Deduplicate similar questions (exact match)
    const uniqueQuestions: { content: string; user_id: string; session_id: string; created_at: string }[] = [];
    const seen = new Set<string>();
    for (const msg of messages) {
      const normalized = msg.content.trim().toLowerCase();
      if (!seen.has(normalized) && normalized.length > 5) {
        seen.add(normalized);
        uniqueQuestions.push(msg);
      }
    }

    if (uniqueQuestions.length < 3) {
      return NextResponse.json({ error: "Minimal 3 pertanyaan unik diperlukan untuk klasifikasi" }, { status: 400 });
    }

    // Prepare prompt (max ~100 questions to fit in context)
    const questionsForLLM = uniqueQuestions.slice(0, 100);
    const numberedList = questionsForLLM.map((q, i) => `${i}. ${q.content}`).join("\n");

    const prompt = CLASSIFY_PROMPT + numberedList;

    // Call LLM
    const response = await chatCompletion(
      [{ role: "user", content: prompt }],
      false
    );

    // Parse result
    let clusters: ClusterResult[] = [];
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        clusters = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return NextResponse.json({ error: "Gagal parse hasil klasifikasi dari LLM", raw: response }, { status: 500 });
    }

    if (!Array.isArray(clusters) || clusters.length === 0) {
      return NextResponse.json({ error: "Tidak ada klaster yang berhasil dibuat" }, { status: 400 });
    }

    // Clear old clusters for this bot
    const { data: oldClusters } = await supabaseAdmin
      .from("question_clusters")
      .select("id")
      .eq("ai_bot_id", botId);

    if (oldClusters && oldClusters.length > 0) {
      const oldIds = oldClusters.map((c) => c.id);
      await supabaseAdmin.from("cluster_items").delete().in("cluster_id", oldIds);
      await supabaseAdmin.from("question_clusters").delete().eq("ai_bot_id", botId);
    }

    // Insert new clusters and items
    let totalClassified = 0;

    for (const cluster of clusters) {
      if (!cluster.name?.trim() || !Array.isArray(cluster.questions)) continue;

      const validIndices = cluster.questions.filter((i) => i >= 0 && i < questionsForLLM.length);
      const clusterQuestions = validIndices.map((i) => questionsForLLM[i]);
      const sampleQuestions = clusterQuestions.slice(0, 3).map((q) => q.content);

      const clusterId = uuid();
      await supabaseAdmin.from("question_clusters").insert({
        id: clusterId,
        ai_bot_id: botId,
        name: cluster.name.trim(),
        description: cluster.description?.trim() || null,
        question_count: clusterQuestions.length,
        sample_questions: JSON.stringify(sampleQuestions),
        representative_question: cluster.representative_question?.trim() || sampleQuestions[0] || null,
        analyzed_at: new Date().toISOString(),
      });

      // Insert items
      if (clusterQuestions.length > 0) {
        const items = clusterQuestions.map((q) => ({
          id: uuid(),
          cluster_id: clusterId,
          question: q.content,
          user_id: q.user_id,
          session_id: q.session_id,
          message_created_at: q.created_at,
        }));

        await supabaseAdmin.from("cluster_items").insert(items);
        totalClassified += items.length;
      }
    }

    return NextResponse.json({
      success: true,
      clusters: clusters.length,
      totalClassified,
      totalQuestions: questionsForLLM.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cluster analysis error:", message);
    return NextResponse.json({ error: `Gagal menganalisis: ${message}` }, { status: 500 });
  }
}

// DELETE: Remove a cluster
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType } = session.user as { role?: string; roleType?: string };
  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clusterId = searchParams.get("id");

  if (!clusterId) {
    return NextResponse.json({ error: "Cluster ID diperlukan" }, { status: 400 });
  }

  await supabaseAdmin.from("cluster_items").delete().eq("cluster_id", clusterId);
  await supabaseAdmin.from("question_clusters").delete().eq("id", clusterId);

  return NextResponse.json({ success: true });
}
