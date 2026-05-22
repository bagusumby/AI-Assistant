import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { ragChat } from "@/lib/rag";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, sessionId } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
  }

  const userId = session.user.id;
  let chatSessionId = sessionId;

  // Create session if not exists
  if (!chatSessionId) {
    chatSessionId = uuid();
    db.prepare("INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)").run(
      chatSessionId, userId, message.slice(0, 50)
    );
  } else {
    const existing = db.prepare("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?").get(chatSessionId, userId);
    if (!existing) {
      db.prepare("INSERT INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)").run(
        chatSessionId, userId, message.slice(0, 50)
      );
    }
  }

  // Save user message
  db.prepare("INSERT INTO chat_messages (id, session_id, user_id, role, content) VALUES (?, ?, ?, 'user', ?)").run(
    uuid(), chatSessionId, userId, message
  );

  // Get history
  const history = db
    .prepare("SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 20")
    .all(chatSessionId) as { role: string; content: string }[];

  try {
    // Stream response
    const { generator, sources } = await ragChat(message, history.slice(0, -1), true);

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "", done: true, sources, sessionId: chatSessionId })}\n\n`));

          // Save assistant response
          db.prepare("INSERT INTO chat_messages (id, session_id, user_id, role, content) VALUES (?, ?, ?, 'assistant', ?)").run(
            uuid(), chatSessionId, userId, fullResponse
          );
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error", done: true })}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
