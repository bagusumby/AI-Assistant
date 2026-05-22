import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { generateEmbeddings } from "@/lib/ai";
import { addDocuments } from "@/lib/vectorstore";
import db from "@/lib/db";
import { PDFParse } from "pdf-parse";

function splitText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Hanya file PDF yang diperbolehkan" }, { status: 400 });
    }

    const fileId = uuid();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Track file
    db.prepare(
      "INSERT INTO uploaded_files (id, user_id, filename, file_size, status) VALUES (?, ?, ?, ?, 'processing')"
    ).run(fileId, session.user.id, file.name, buffer.length);

    // Extract text
    const pdf = new PDFParse({ data: buffer });
    const result = await pdf.getText();
    const text = result.text;

    if (!text.trim()) {
      db.prepare("UPDATE uploaded_files SET status = 'failed' WHERE id = ?").run(fileId);
      return NextResponse.json({ error: "PDF tidak mengandung teks" }, { status: 400 });
    }

    // Split into chunks
    const chunks = splitText(text);

    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks);

    // Store in ChromaDB
    const ids = chunks.map((_, i) => `${fileId}_${i}`);
    const metadatas = chunks.map((_, i) => ({
      filename: file.name,
      pageNumber: 1,
      chunkIndex: i,
      userId: session.user!.id!,
    }));

    await addDocuments(ids, embeddings, chunks, metadatas);

    // Update status
    db.prepare("UPDATE uploaded_files SET status = 'completed', total_chunks = ? WHERE id = ?").run(
      chunks.length, fileId
    );

    return NextResponse.json({
      success: true,
      message: `File '${file.name}' berhasil diproses. ${chunks.length} chunks disimpan.`,
      filename: file.name,
      totalChunks: chunks.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Gagal memproses file: ${message}` }, { status: 500 });
  }
}
