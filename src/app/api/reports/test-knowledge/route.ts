import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ragChat } from "@/lib/rag";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType } = session.user as {
    role?: string;
    roleType?: string;
  };

  // Only admin or managers can test knowledge
  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { question, botId } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ error: "Pertanyaan tidak boleh kosong" }, { status: 400 });
    }
    if (!botId) {
      return NextResponse.json({ error: "AI Bot ID diperlukan" }, { status: 400 });
    }

    // Validate bot exists
    const { data: bot } = await supabaseAdmin
      .from("ai_bots")
      .select("id, name, system_prompt")
      .eq("id", botId)
      .single();

    if (!bot) {
      return NextResponse.json({ error: "AI Bot tidak ditemukan" }, { status: 404 });
    }

    // Run RAG in non-streaming mode to get the answer
    const result = await ragChat(
      question.trim(),
      [], // no history for test
      botId,
      false,
      bot.system_prompt
    );

    return NextResponse.json({
      success: true,
      answer: result.response,
      sources: result.sources,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Test knowledge error:", message);
    return NextResponse.json({ error: `Gagal menguji knowledge: ${message}` }, { status: 500 });
  }
}
