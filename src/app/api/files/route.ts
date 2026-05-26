import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteByFilename } from "@/lib/vectorstore";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Show uploaded files for the current user
  const { data: files, error } = await supabaseAdmin
    .from("uploaded_files")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(files || []);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admin can delete files
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Hanya admin yang dapat menghapus dokumen" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");

  if (!fileId) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 });
  }

  const { data: file } = await supabaseAdmin
    .from("uploaded_files")
    .select("filename")
    .eq("id", fileId)
    .eq("user_id", session.user.id)
    .single();

  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  // Delete document chunks from Supabase 'documents' table
  await deleteByFilename(file.filename, session.user.id);

  // Delete file record
  await supabaseAdmin.from("uploaded_files").delete().eq("id", fileId);

  return NextResponse.json({ success: true });
}
