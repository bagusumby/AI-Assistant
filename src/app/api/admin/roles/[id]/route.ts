import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// PUT - Update role
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { label, description } = await req.json();

  if (!label) {
    return NextResponse.json({ error: "label wajib diisi" }, { status: 400 });
  }

  // Cannot change system role names/types - only label/description
  const { error } = await supabaseAdmin
    .from("roles")
    .update({ label, description: description || null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Delete role (system roles cannot be deleted)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Check if system role
  const { data: role } = await supabaseAdmin
    .from("roles")
    .select("type")
    .eq("id", id)
    .single();

  if (!role) {
    return NextResponse.json({ error: "Role tidak ditemukan" }, { status: 404 });
  }

  if (role.type === "system") {
    return NextResponse.json({ error: "System role tidak dapat dihapus" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("roles").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
