import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType, botId } = session.user as { role?: string; roleType?: string; botId?: string };

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { sessionId } = await params;

  // Verify the session belongs to a bot this manager owns (or admin can see all)
  if (role !== "admin") {
    const { data: chatSession } = await supabaseAdmin
      .from("chat_sessions")
      .select("ai_bot_id")
      .eq("id", sessionId)
      .single();

    if (!chatSession || chatSession.ai_bot_id !== botId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: messages, error } = await supabaseAdmin
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(messages || []);
}
