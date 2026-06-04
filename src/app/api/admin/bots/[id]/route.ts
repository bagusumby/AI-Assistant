import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET - Get single bot
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("ai_bots")
    .select("id, name, slug, description, chat_enabled, system_prompt, created_at, manager_role_id, roles(id, name, label)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Bot tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PUT - Update bot
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { name, description, manager_role_id, chat_enabled, system_prompt } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "name wajib diisi" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("ai_bots")
    .update({
      name,
      description: description || null,
      manager_role_id: manager_role_id || null,
      chat_enabled: chat_enabled ?? true,
      system_prompt: system_prompt || null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Delete bot
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabaseAdmin.from("ai_bots").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
