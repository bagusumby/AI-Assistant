import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  const { data: messages, error } = await supabaseAdmin
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formatted = (messages || []).map((m) => ({
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }));

  return NextResponse.json(formatted);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  await supabaseAdmin
    .from("chat_messages")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", session.user.id);

  await supabaseAdmin
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", session.user.id);

  return NextResponse.json({ success: true });
}
