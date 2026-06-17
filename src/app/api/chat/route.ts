import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { ragChat } from "@/lib/rag";
import { generateQueryEmbedding } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, sessionId, botId } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
  }

  if (!botId) {
    return NextResponse.json({ error: "Pilih AI Bot terlebih dahulu" }, { status: 400 });
  }

  // Validate bot exists and is enabled
  const { data: bot } = await supabaseAdmin
    .from("ai_bots")
    .select("id, name, system_prompt, chat_enabled")
    .eq("id", botId)
    .single();

  if (!bot) {
    return NextResponse.json({ error: "AI Bot tidak ditemukan" }, { status: 404 });
  }

  if (!bot.chat_enabled) {
    return NextResponse.json({ error: "AI Bot ini sedang dinonaktifkan" }, { status: 403 });
  }

  const userId = session.user.id;
  let chatSessionId = sessionId;

  // Create session if not exists
  if (!chatSessionId) {
    chatSessionId = uuid();
    await supabaseAdmin.from("chat_sessions").insert({
      id: chatSessionId,
      user_id: userId,
      ai_bot_id: botId,
      title: message.slice(0, 50),
    });
  } else {
    const { data: existing } = await supabaseAdmin
      .from("chat_sessions")
      .select("id, ai_bot_id")
      .eq("id", chatSessionId)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      await supabaseAdmin.from("chat_sessions").insert({
        id: chatSessionId,
        user_id: userId,
        ai_bot_id: botId,
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
    const { generator, sources } = await ragChat(
      message,
      (history || []).slice(0, -1),
      botId,
      true,
      bot.system_prompt
    );

    const encoder = new TextEncoder();
    let fullResponse = "";
    const assistantMessageId = uuid();

    const UNANSWERED_PREFIXES = [
      "Maaf, saya tidak menemukan informasi yang relevan",
      "Maaf, saya tidak menemukan informasi tersebut",
    ];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "", done: true, sources, sessionId: chatSessionId, botId, messageId: assistantMessageId })}\n\n`));

          await supabaseAdmin.from("chat_messages").insert({
            id: assistantMessageId,
            session_id: chatSessionId,
            user_id: userId,
            role: "assistant",
            content: fullResponse,
          });

          // Auto-capture unanswered questions
          const isUnanswered = UNANSWERED_PREFIXES.some((prefix) => fullResponse.startsWith(prefix));
          if (isUnanswered) {
            await supabaseAdmin.from("unanswered_questions").insert({
              id: uuid(),
              session_id: chatSessionId,
              user_id: userId,
              ai_bot_id: botId,
              question: message,
              bot_response: fullResponse,
            });
          }

          // --- Topic classification (non-blocking, best-effort) ---
          try {
            const questionEmbedding = await generateQueryEmbedding(message);
            const { data: matchedTopic } = await supabaseAdmin.rpc("match_topic", {
              query_embedding: JSON.stringify(questionEmbedding),
              filter_ai_bot_id: botId,
              match_threshold: 0.5,
            });

            if (matchedTopic && matchedTopic.length > 0) {
              const topMatch = matchedTopic[0];
              // Insert question into topic_questions
              await supabaseAdmin.from("topic_questions").insert({
                id: uuid(),
                topic_id: topMatch.topic_id,
                session_id: chatSessionId,
                user_id: userId,
                question: message,
                similarity: topMatch.similarity,
              });
              // Increment topic count
              await supabaseAdmin.rpc("increment_topic_count", { topic_id_param: topMatch.topic_id });
            }
          } catch {
            // Non-critical: topic classification failure should not affect chat
          }
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
