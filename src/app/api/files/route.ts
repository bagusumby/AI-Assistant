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
    const botId = searchParams.get("botId");
    if (botId) query = query.eq("ai_bot_id", botId);
  } else {
    const botId = session.user.botId;
    if (!botId) return NextResponse.json([]);
    query = query.eq("ai_bot_id", botId);
  }

  const { data: files, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with user names and bot names
  const userIds = [...new Set((files || []).map((f) => f.user_id).filter(Boolean))];
  const botIds = [...new Set((files || []).map((f) => f.ai_bot_id).filter(Boolean))];

  let usersMap: Record<string, { name: string; email: string }> = {};
  if (userIds.length > 0) {
    const { data: usersData } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .in("id", userIds);
    if (usersData) {
      usersMap = Object.fromEntries(usersData.map((u) => [u.id, { name: u.name, email: u.email }]));
    }
  }

  let botsMap: Record<string, { name: string }> = {};
  if (botIds.length > 0) {
    const { data: botsData } = await supabaseAdmin
      .from("ai_bots")
      .select("id, name")
      .in("id", botIds);
    if (botsData) {
      botsMap = Object.fromEntries(botsData.map((b) => [b.id, { name: b.name }]));
    }
  }

  const enriched = (files || []).map((f) => ({
    ...f,
    uploaded_by: usersMap[f.user_id] || null,
    bot_name: botsMap[f.ai_bot_id]?.name || null,
    source_type: f.filename.startsWith("FAQ-") ? "faq" : "pdf",
  }));

  return NextResponse.json(enriched);
}

// GET preview content of a file's documents
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const roleType = session.user.roleType;

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { filename, botId } = await req.json();

    if (!filename || !botId) {
      return NextResponse.json({ error: "filename dan botId diperlukan" }, { status: 400 });
    }

    // Fetch document chunks for this file
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("content, metadata")
      .eq("ai_bot_id", botId)
      .filter("metadata->>filename", "eq", filename)
      .order("metadata->>chunk_index", { ascending: true })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      chunks: (data || []).map((d) => ({
        content: d.content,
        metadata: d.metadata,
      })),
      totalChunks: data?.length || 0,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
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

  // If this is a FAQ file, reset resolved status on related records
  if (file.filename.startsWith("FAQ-")) {
    await supabaseAdmin
      .from("unanswered_questions")
      .update({ resolved_at: null, resolved_filename: null, resolved_answer: null })
      .eq("resolved_filename", file.filename);

    await supabaseAdmin
      .from("feedback_reports")
      .update({ resolved_at: null, resolved_filename: null, resolved_answer: null })
      .eq("resolved_filename", file.filename);
  }

  // Delete file record
  await supabaseAdmin.from("uploaded_files").delete().eq("id", fileId);

  return NextResponse.json({ success: true });
}
