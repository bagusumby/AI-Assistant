import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatCompletion, generateEmbeddings } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase";

const EXTRACT_PROMPT = `Analisis teks dokumen berikut dan identifikasi 3-7 topik utama yang dibahas.
Untuk setiap topik, berikan:
- name: nama topik singkat (2-5 kata, dalam Bahasa Indonesia)
- description: deskripsi 1 kalimat
- sample_question: contoh pertanyaan yang user mungkin tanyakan tentang topik ini (dalam Bahasa Indonesia)

Return HANYA JSON array valid, tanpa penjelasan lain, tanpa markdown code block:
[{"name": "...", "description": "...", "sample_question": "..."}]

Teks dokumen:
`;

interface ExtractedTopic {
  name: string;
  description: string;
  sample_question: string;
}

// POST: Extract topics from document text and save to DB
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
    const { text, botId } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "Teks diperlukan" }, { status: 400 });
    }
    if (!botId) {
      return NextResponse.json({ error: "Bot ID diperlukan" }, { status: 400 });
    }

    // Truncate text to ~4000 chars for LLM context (enough to identify topics)
    const truncatedText = text.slice(0, 4000);

    // Ask LLM to extract topics
    const prompt = EXTRACT_PROMPT + truncatedText;
    const response = await chatCompletion(
      [{ role: "user", content: prompt }],
      false
    );

    // Parse JSON response
    let topics: ExtractedTopic[] = [];
    try {
      // Try to extract JSON from response (LLM might wrap in markdown)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return NextResponse.json({
        error: "Gagal parse topik dari LLM",
        raw: response,
      }, { status: 500 });
    }

    if (!Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: "Tidak ada topik yang berhasil di-extract" }, { status: 400 });
    }

    // Generate embeddings for each topic (name + description combined)
    const topicTexts = topics.map((t) => `${t.name}. ${t.description}. ${t.sample_question}`);
    const embeddings = await generateEmbeddings(topicTexts);

    // Upsert topics (skip if name already exists for this bot)
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      if (!topic.name?.trim()) continue;

      const { error } = await supabaseAdmin
        .from("topics")
        .upsert(
          {
            ai_bot_id: botId,
            name: topic.name.trim(),
            description: topic.description?.trim() || null,
            sample_question: topic.sample_question?.trim() || null,
            embedding: JSON.stringify(embeddings[i]),
          },
          { onConflict: "ai_bot_id,name", ignoreDuplicates: true }
        );

      if (error) {
        skipped++;
      } else {
        inserted++;
      }
    }

    return NextResponse.json({
      success: true,
      topics: topics.map((t) => t.name),
      inserted,
      skipped,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Extract topics error:", message);
    return NextResponse.json({ error: `Gagal extract topik: ${message}` }, { status: 500 });
  }
}
