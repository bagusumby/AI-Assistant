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

  // Only admin can upload
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Hanya admin yang dapat mengupload dokumen" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Hanya file PDF yang diperbolehkan" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Track file in uploaded_files
    await supabaseAdmin.from("uploaded_files").insert({
      user_id: session.user.id,
      filename: file.name,
      file_size: buffer.length,
      status: "processing",
    });

    // Extract text from PDF (page by page, same as Python backend using pdfplumber-style)
    const { PDFParse } = await import("pdf-parse");
    const pdf = new PDFParse({ data: buffer });
    const pdfResult = await pdf.getText();

    // Build pages array (same as Python backend's pdf_processor.extract_text)
    const pages: { text: string; pageNumber: number }[] = [];
    if (pdfResult.pages && pdfResult.pages.length > 0) {
      for (let i = 0; i < pdfResult.pages.length; i++) {
        const pageText = pdfResult.pages[i]?.text || "";
        if (pageText.trim()) {
          pages.push({ text: pageText.trim(), pageNumber: i + 1 });
        }
      }
    }

    // Fallback: if pages not available, use full text
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

    // Split into chunks per page using RecursiveCharacterTextSplitter
    // (same as Python backend: text_splitter.split_pages)
    const allChunks: { content: string; metadata: { filename: string; pageNumber: number; chunkIndex: number; totalChunks: number } }[] = [];

    for (const page of pages) {
      const pageChunks = splitTextRecursive(page.text, 1000, 200);
      for (const chunkText of pageChunks) {
        allChunks.push({
          content: chunkText,
          metadata: {
            filename: file.name,
            pageNumber: page.pageNumber,
            chunkIndex: 0, // updated below
            totalChunks: 0, // updated below
          },
        });
      }
    }

    // Update global chunk indices (same as Python backend)
    for (let i = 0; i < allChunks.length; i++) {
      allChunks[i].metadata.chunkIndex = i;
      allChunks[i].metadata.totalChunks = allChunks.length;
    }

    // Generate embeddings (full 2560 dim, batched in groups of 20)
    const texts = allChunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts);

    // Store in Supabase 'documents' table (same as Python backend)
    await addDocuments(session.user.id, allChunks, embeddings);

    // Update file status
    await supabaseAdmin
      .from("uploaded_files")
      .update({ status: "completed", total_chunks: allChunks.length })
      .eq("filename", file.name)
      .eq("user_id", session.user.id);

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
