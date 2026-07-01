import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET: Return top N topics with sample questions for quick question UI
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId");
  const limit = parseInt(searchParams.get("limit") || "5", 10);

  if (!botId) {
    return NextResponse.json({ error: "botId diperlukan" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("topics")
    .select("id, name, sample_question, question_count")
    .eq("ai_bot_id", botId)
    .gt("question_count", 0)
    .not("sample_question", "is", null)
    .order("question_count", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return formatted quick questions
  const quickQuestions = (data || []).map((topic) => ({
    id: topic.id,
    topic: topic.name,
    question: topic.sample_question,
    count: topic.question_count,
  }));

  return NextResponse.json(quickQuestions);
}
