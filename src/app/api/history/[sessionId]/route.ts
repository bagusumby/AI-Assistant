import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  const messages = db
    .prepare("SELECT role, content, created_at as createdAt FROM chat_messages WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC")
    .all(sessionId, session.user.id);

  return NextResponse.json(messages);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  db.prepare("DELETE FROM chat_messages WHERE session_id = ? AND user_id = ?").run(sessionId, session.user.id);
  db.prepare("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?").run(sessionId, session.user.id);

  return NextResponse.json({ success: true });
}
