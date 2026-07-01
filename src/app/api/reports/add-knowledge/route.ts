import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateEmbeddings } from "@/lib/ai";
import { addDocuments, deleteByFilename } from "@/lib/vectorstore";
import { supabaseAdmin } from "@/lib/supabase";
import { sendUnansweredResolvedEmail, sendFeedbackResolvedEmail } from "@/lib/email";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType, botId: sessionBotId } = session.user as {
    role?: string;
    roleType?: string;
    botId?: string;
  };

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { question, answer, botId, sourceType, sourceId, replaceFilename } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ error: "Pertanyaan tidak boleh kosong" }, { status: 400 });
    }
    if (!answer?.trim()) {
      return NextResponse.json({ error: "Jawaban tidak boleh kosong" }, { status: 400 });
    }
    if (!botId) {
      return NextResponse.json({ error: "AI Bot ID diperlukan" }, { status: 400 });
    }

    if (role !== "admin" && roleType === "manager" && sessionBotId !== botId) {
      return NextResponse.json({ error: "Anda hanya bisa menambah knowledge ke bot Anda sendiri" }, { status: 403 });
    }

    const { data: bot } = await supabaseAdmin
      .from("ai_bots")
      .select("id, name")
      .eq("id", botId)
      .single();

    if (!bot) {
      return NextResponse.json({ error: "AI Bot tidak ditemukan" }, { status: 404 });
    }

    // If replacing an existing FAQ, delete the old one first
    if (replaceFilename) {
      await deleteByFilename(replaceFilename, botId);
      await supabaseAdmin.from("uploaded_files").delete()
        .eq("filename", replaceFilename)
        .eq("ai_bot_id", botId);
    }

    // Build FAQ content - stored as ONE single document (no chunking)
    const timestamp = Date.now();
    const filename = `FAQ-${timestamp}.txt`;
    const faqContent = `FAQ - Pertanyaan yang Sering Diajukan\n\nQ: ${question.trim()}\nA: ${answer.trim()}`;

    const allChunks = [{
      content: faqContent,
      metadata: {
        filename,
        pageNumber: 1,
        chunkIndex: 0,
        totalChunks: 1,
      },
    }];

    const embeddings = await generateEmbeddings([faqContent]);
    await addDocuments(session.user.id, botId, allChunks, embeddings);

    // Track in uploaded_files
    const faqBytes = Buffer.byteLength(faqContent, "utf-8");
    await supabaseAdmin.from("uploaded_files").insert({
      user_id: session.user.id,
      ai_bot_id: botId,
      filename,
      file_size: faqBytes,
      total_chunks: 1,
      status: "completed",
    });

    // Mark source as resolved and store the answer for display
    const resolveData = {
      resolved_at: new Date().toISOString(),
      resolved_filename: filename,
      resolved_answer: answer.trim(),
    };

    if (sourceType === "unanswered" && sourceId) {
      const { data: src } = await supabaseAdmin
        .from("unanswered_questions")
        .select("user_id")
        .eq("id", sourceId)
        .single();

      await supabaseAdmin
        .from("unanswered_questions")
        .update(resolveData)
        .eq("id", sourceId);

      // Fire-and-forget: notify user via email
      if (src?.user_id) {
        const userId = src.user_id;
        const capturedQuestion = question.trim();
        const capturedAnswer = answer.trim();
        const capturedBotName = bot.name;
        (async () => {
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("email, name")
            .eq("id", userId)
            .single();
          if (!user?.email) return;
          await sendUnansweredResolvedEmail({
            to: user.email,
            userName: user.name || user.email,
            question: capturedQuestion,
            answer: capturedAnswer,
            botName: capturedBotName,
            appUrl: APP_URL,
          });
        })().catch((err) => console.error("[Email] sendUnansweredResolvedEmail failed:", err));
      }
    }

    if (sourceType === "feedback" && sourceId) {
      const { data: src } = await supabaseAdmin
        .from("feedback_reports")
        .select("user_id, message, feedback_type")
        .eq("id", sourceId)
        .single();

      await supabaseAdmin
        .from("feedback_reports")
        .update(resolveData)
        .eq("id", sourceId);

      // Fire-and-forget: notify user via email
      if (src?.user_id) {
        const userId = src.user_id;
        const capturedFeedbackMessage = src.message ?? null;
        const capturedFeedbackType = src.feedback_type ?? null;
        const capturedAnswer = answer.trim();
        const capturedBotName = bot.name;
        (async () => {
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("email, name")
            .eq("id", userId)
            .single();
          if (!user?.email) return;
          await sendFeedbackResolvedEmail({
            to: user.email,
            userName: user.name || user.email,
            feedbackMessage: capturedFeedbackMessage,
            feedbackType: capturedFeedbackType,
            answer: capturedAnswer,
            botName: capturedBotName,
            appUrl: APP_URL,
          });
        })().catch((err) => console.error("[Email] sendFeedbackResolvedEmail failed:", err));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Knowledge base berhasil ditambahkan sebagai 1 dokumen utuh.`,
      filename,
      chunks: 1,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Add knowledge error:", message);
    return NextResponse.json({ error: `Gagal menambahkan knowledge: ${message}` }, { status: 500 });
  }
}

// PATCH: Mark questions as resolved without uploading FAQ (for similar questions / bulk action)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType } = session.user as {
    role?: string;
    roleType?: string;
  };

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { ids, sourceType, resolvedFilename, resolvedAnswer } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "IDs diperlukan" }, { status: 400 });
    }

    const table = sourceType === "feedback" ? "feedback_reports" : "unanswered_questions";

    // Fetch records before update to capture data needed for email
    const selectFields = sourceType === "feedback"
      ? "id, user_id, message, feedback_type, ai_bot_id"
      : "id, user_id, question, ai_bot_id";

    const { data: records } = await supabaseAdmin
      .from(table)
      .select(selectFields)
      .in("id", ids);

    const { error } = await supabaseAdmin
      .from(table)
      .update({
        resolved_at: new Date().toISOString(),
        resolved_filename: resolvedFilename || null,
        resolved_answer: resolvedAnswer || null,
      })
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget: send email notifications for each resolved record
    if (records && records.length > 0) {
      const capturedRecords = (records as unknown) as Array<{
        id: string;
        user_id: string;
        ai_bot_id: string;
        question?: string;
        message?: string | null;
        feedback_type?: string | null;
      }>;
      const capturedAnswer = resolvedAnswer || null;
      const capturedSourceType = sourceType;

      (async () => {
        const userIds = [...new Set(capturedRecords.map((r) => r.user_id).filter(Boolean))];
        const botIds = [...new Set(capturedRecords.map((r) => r.ai_bot_id).filter(Boolean))];

        const [{ data: usersData }, { data: botsData }] = await Promise.all([
          supabaseAdmin.from("users").select("id, email, name").in("id", userIds),
          supabaseAdmin.from("ai_bots").select("id, name").in("id", botIds),
        ]);

        const usersMap = Object.fromEntries((usersData || []).map((u) => [u.id, u]));
        const botsMap = Object.fromEntries((botsData || []).map((b) => [b.id, b]));

        for (const record of capturedRecords) {
          const user = usersMap[record.user_id];
          if (!user?.email) continue;
          const bot = botsMap[record.ai_bot_id];
          const botName = bot?.name || "AI Assistant";

          if (capturedSourceType === "unanswered") {
            await sendUnansweredResolvedEmail({
              to: user.email,
              userName: user.name || user.email,
              question: record.question || "",
              answer: capturedAnswer,
              botName,
              appUrl: APP_URL,
            });
          } else {
            await sendFeedbackResolvedEmail({
              to: user.email,
              userName: user.name || user.email,
              feedbackMessage: record.message,
              feedbackType: record.feedback_type,
              answer: capturedAnswer,
              botName,
              appUrl: APP_URL,
            });
          }
        }
      })().catch((err) => console.error("[Email] Bulk notification failed:", err));
    }

    return NextResponse.json({ success: true, resolved: ids.length });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
