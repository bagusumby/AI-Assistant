import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET: List topics per bot
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
  const includeQuestions = searchParams.get("includeQuestions") === "true";
  const topicId = searchParams.get("topicId");

  // If requesting questions for a specific topic
  if (topicId && includeQuestions) {
    const { data: questions, error } = await supabaseAdmin
      .from("topic_questions")
      .select("id, question, similarity, created_at, user_id")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with user names
    const userIds = [...new Set((questions || []).map((q) => q.user_id).filter(Boolean))];
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

    const enriched = (questions || []).map((q) => ({
      ...q,
      users: usersMap[q.user_id] || null,
    }));

    return NextResponse.json(enriched);
  }

  // List all topics
  let query = supabaseAdmin
    .from("topics")
    .select("id, name, description, question_count, sample_question, created_at, ai_bot_id, ai_bots!topics_ai_bot_id_fkey(id, name)")
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

// PATCH: Edit topic name/description/sample_question
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType } = session.user as { role?: string; roleType?: string };
  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { id, name, description, sample_question } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Topic ID diperlukan" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (sample_question !== undefined) updateData.sample_question = sample_question;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Tidak ada data untuk diupdate" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("topics")
      .update(updateData)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// DELETE: Remove a topic
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
  const topicId = searchParams.get("id");

  if (!topicId) {
    return NextResponse.json({ error: "Topic ID diperlukan" }, { status: 400 });
  }

  // Delete topic (cascade deletes topic_questions)
  const { error } = await supabaseAdmin
    .from("topics")
    .delete()
    .eq("id", topicId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
