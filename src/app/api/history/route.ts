import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sessions, error } = await supabaseAdmin
    .from("chat_sessions")
    .select("id, title, ai_bot_id, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get last message for each session
  const sessionsWithLastMessage = await Promise.all(
    (sessions || []).map(async (s) => {
      const { data: msgs } = await supabaseAdmin
        .from("chat_messages")
        .select("content")
        .eq("session_id", s.id)
        .order("created_at", { ascending: false })
        .limit(1);

      return {
        ...s,
        ai_bot_id: s.ai_bot_id ?? null,
        createdAt: s.created_at,
        lastMessage: msgs?.[0]?.content || null,
      };
    })
  );

  return NextResponse.json(sessionsWithLastMessage);
}
