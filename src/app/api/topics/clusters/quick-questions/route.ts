import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const DEFAULT_QUESTIONS = [
  { id: "default-1", topic: "Umum", question: "Apa yang bisa kamu bantu?", count: 0 },
  { id: "default-2", topic: "Informasi", question: "Informasi apa saja yang tersedia?", count: 0 },
  { id: "default-3", topic: "Panduan", question: "Bagaimana cara menggunakan sistem ini?", count: 0 },
];

// GET: Return top 5 quick questions from clusters for a bot
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId");

  if (!botId) {
    return NextResponse.json({ error: "botId diperlukan" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("question_clusters")
      .select("id, name, representative_question, sample_questions, question_count")
      .eq("ai_bot_id", botId)
      .gt("question_count", 0)
      .order("question_count", { ascending: false })
      .limit(5);

    if (error) {
      // If column doesn't exist yet, return defaults
      if (error.message.includes("does not exist")) {
        return NextResponse.json(DEFAULT_QUESTIONS);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(DEFAULT_QUESTIONS);
    }

    const quickQuestions = data.map((cluster) => {
      // Use representative_question, fallback to first sample question
      let question = cluster.representative_question;
      if (!question) {
        const samples = typeof cluster.sample_questions === "string"
          ? JSON.parse(cluster.sample_questions)
          : cluster.sample_questions;
        question = Array.isArray(samples) && samples.length > 0 ? samples[0] : null;
      }

      return {
        id: cluster.id,
        topic: cluster.name,
        question: question || `Tentang ${cluster.name}`,
        count: cluster.question_count,
      };
    }).filter((q) => q.question);

    // If we got less than 3, pad with defaults
    if (quickQuestions.length < 3) {
      const needed = 3 - quickQuestions.length;
      quickQuestions.push(...DEFAULT_QUESTIONS.slice(0, needed));
    }

    return NextResponse.json(quickQuestions);
  } catch {
    return NextResponse.json(DEFAULT_QUESTIONS);
  }
}
