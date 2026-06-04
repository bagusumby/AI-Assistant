import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteByFilename } from "@/lib/vectorstore";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const roleType = session.user.roleType;

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  let query = supabaseAdmin
    .from("uploaded_files")
    .select("*")
    .order("created_at", { ascending: false });

  if (role === "admin") {
    // Admin can filter by botId or see all
    const botId = searchParams.get("botId");
    if (botId) query = query.eq("ai_bot_id", botId);
  } else {
    // Manager: only see files for their bot
    const botId = session.user.botId;
    if (!botId) return NextResponse.json([]);
    query = query.eq("ai_bot_id", botId);
  }

  const { data: files, error } = await query;

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

  const role = session.user.role;
  const roleType = session.user.roleType;

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("id");

  if (!fileId) {
    return NextResponse.json({ error: "File ID required" }, { status: 400 });
  }

  let fileQuery = supabaseAdmin
    .from("uploaded_files")
    .select("filename, ai_bot_id")
    .eq("id", fileId);

  // Managers can only delete files from their own bot
  if (roleType === "manager") {
    const botId = session.user.botId;
    if (!botId) return NextResponse.json({ error: "Bot tidak ditemukan" }, { status: 400 });
    fileQuery = fileQuery.eq("ai_bot_id", botId);
  }

  const { data: file } = await fileQuery.single();

  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  // Delete document chunks from vector store
  await deleteByFilename(file.filename, file.ai_bot_id as string);

  // Delete file record
  await supabaseAdmin.from("uploaded_files").delete().eq("id", fileId);

  return NextResponse.json({ success: true });
}
