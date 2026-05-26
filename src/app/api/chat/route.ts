import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { ragChat } from "@/lib/rag";
import { supabaseAdmin } from "@/lib/supabase";

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
    await supabaseAdmin.from("chat_sessions").insert({
      id: chatSessionId,
      user_id: userId,
      title: message.slice(0, 50),
    });
  } else {
    const { data: existing } = await supabaseAdmin
      .from("chat_sessions")
      .select("id")
      .eq("id", chatSessionId)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      await supabaseAdmin.from("chat_sessions").insert({
        id: chatSessionId,
        user_id: userId,
        title: message.slice(0, 50),
      });
    }
  }

  // Save user message
  await supabaseAdmin.from("chat_messages").insert({
    id: uuid(),
    session_id: chatSessionId,
    user_id: userId,
    role: "user",
    content: message,
  });

  // Get history
  const { data: history } = await supabaseAdmin
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", chatSessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  try {
    // Stream response (pass userId for user-scoped document search)
    const { generator, sources } = await ragChat(message, (history || []).slice(0, -1), userId, true);

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
          await supabaseAdmin.from("chat_messages").insert({
            id: uuid(),
            session_id: chatSessionId,
            user_id: userId,
            role: "assistant",
            content: fullResponse,
          });
        } catch {
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
