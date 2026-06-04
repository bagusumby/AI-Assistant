import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateEmbeddings } from "@/lib/ai";
import { addDocuments } from "@/lib/vectorstore";
import { supabaseAdmin } from "@/lib/supabase";
import { splitTextRecursive } from "@/lib/textSplitter";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const roleType = session.user.roleType;

  // Only admin or managers can upload
  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Hanya file PDF yang diperbolehkan" }, { status: 400 });
    }

    // Determine which bot to upload to
    let botId: string | null = null;

    if (roleType === "manager") {
      // Manager: use their linked bot from session
      botId = session.user.botId ?? null;
      if (!botId) {
        return NextResponse.json({ error: "Manager tidak memiliki AI Bot yang terhubung" }, { status: 400 });
      }
    } else if (role === "admin") {
      // Admin: must specify botId in form data
      const formBotId = formData.get("botId") as string | null;
      if (!formBotId) {
        return NextResponse.json({ error: "Admin harus memilih AI Bot tujuan upload" }, { status: 400 });
      }
      // Validate bot exists
      const { data: bot } = await supabaseAdmin.from("ai_bots").select("id").eq("id", formBotId).single();
      if (!bot) {
        return NextResponse.json({ error: "AI Bot tidak ditemukan" }, { status: 404 });
      }
      botId = formBotId;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Track file in uploaded_files
    await supabaseAdmin.from("uploaded_files").insert({
      user_id: session.user.id,
      ai_bot_id: botId,
      filename: file.name,
      file_size: buffer.length,
      status: "processing",
    });

    // Extract text from PDF
    const { PDFParse } = await import("pdf-parse");
    const pdf = new PDFParse({ data: buffer });
    const pdfResult = await pdf.getText();

    const pages: { text: string; pageNumber: number }[] = [];
    if (pdfResult.pages && pdfResult.pages.length > 0) {
      for (let i = 0; i < pdfResult.pages.length; i++) {
        const pageText = pdfResult.pages[i]?.text || "";
        if (pageText.trim()) {
          pages.push({ text: pageText.trim(), pageNumber: i + 1 });
        }
      }
    }

    if (pages.length === 0 && pdfResult.text?.trim()) {
      pages.push({ text: pdfResult.text.trim(), pageNumber: 1 });
    }

    if (pages.length === 0) {
      await supabaseAdmin
        .from("uploaded_files")
        .update({ status: "failed" })
        .eq("filename", file.name)
        .eq("user_id", session.user.id);
      return NextResponse.json({ error: "PDF tidak mengandung teks" }, { status: 400 });
    }

    const allChunks: { content: string; metadata: { filename: string; pageNumber: number; chunkIndex: number; totalChunks: number } }[] = [];

    for (const page of pages) {
      const pageChunks = splitTextRecursive(page.text, 1000, 200);
      for (const chunkText of pageChunks) {
        allChunks.push({
          content: chunkText,
          metadata: { filename: file.name, pageNumber: page.pageNumber, chunkIndex: 0, totalChunks: 0 },
        });
      }
    }

    for (let i = 0; i < allChunks.length; i++) {
      allChunks[i].metadata.chunkIndex = i;
      allChunks[i].metadata.totalChunks = allChunks.length;
    }

    const texts = allChunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts);

    await addDocuments(session.user.id, botId!, allChunks, embeddings);

    await supabaseAdmin
      .from("uploaded_files")
      .update({ status: "completed", total_chunks: allChunks.length })
      .eq("filename", file.name)
      .eq("user_id", session.user.id)
      .eq("ai_bot_id", botId);

    return NextResponse.json({
      success: true,
      message: `File '${file.name}' berhasil diproses. ${allChunks.length} chunks disimpan.`,
      filename: file.name,
      totalChunks: allChunks.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Gagal memproses file: ${message}` }, { status: 500 });
  }
}

