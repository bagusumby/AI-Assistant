import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { deleteByFilename } from "@/lib/vectorstore";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Show all uploaded files to all users (shared knowledge base)
  const files = db
    .prepare("SELECT * FROM uploaded_files ORDER BY created_at DESC")
    .all();

  return NextResponse.json(files);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");

  if (!fileId) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 });
  }

  const file = db
    .prepare("SELECT * FROM uploaded_files WHERE id = ?")
    .get(fileId) as { filename: string } | undefined;

  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  await deleteByFilename(file.filename);
  db.prepare("DELETE FROM uploaded_files WHERE id = ?").run(fileId);

  return NextResponse.json({ success: true });
}
