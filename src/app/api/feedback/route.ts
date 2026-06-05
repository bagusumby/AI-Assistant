import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

const VALID_TYPES = ["incomplete", "incorrect", "unclear", "not_relevant", "outdated", "other"] as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { message_id, session_id, bot_id, feedback_type, message } = body;

  if (!session_id || !bot_id || !feedback_type) {
    return NextResponse.json({ error: "session_id, bot_id, dan feedback_type wajib diisi" }, { status: 400 });
  }

  if (!VALID_TYPES.includes(feedback_type)) {
    return NextResponse.json({ error: "feedback_type tidak valid" }, { status: 400 });
  }

  // Validate chat session belongs to the requesting user
  const { data: chatSession } = await supabaseAdmin
    .from("chat_sessions")
    .select("id, user_id, ai_bot_id")
    .eq("id", session_id)
    .eq("user_id", session.user.id)
    .single();

  if (!chatSession) {
    return NextResponse.json({ error: "Sesi chat tidak ditemukan atau bukan milik Anda" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("feedback_reports").insert({
    id: uuid(),
    message_id: message_id || null,
    session_id,
    user_id: session.user.id,
    ai_bot_id: bot_id,
    feedback_type,
    message: message?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
