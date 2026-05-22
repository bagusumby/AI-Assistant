import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = db
    .prepare(`
      SELECT cs.id, cs.title, cs.created_at as createdAt,
        (SELECT content FROM chat_messages WHERE session_id = cs.id ORDER BY created_at DESC LIMIT 1) as lastMessage
      FROM chat_sessions cs
      WHERE cs.user_id = ?
      ORDER BY cs.created_at DESC
    `)
    .all(session.user.id);

  return NextResponse.json(sessions);
}
