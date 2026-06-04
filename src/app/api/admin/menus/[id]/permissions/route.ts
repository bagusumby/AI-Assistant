import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

// GET - List all roles that have access to this menu
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("role_menu_permissions")
    .select("id, role_id, roles(id, name, label, type)")
    .eq("menu_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST - Grant role access to this menu
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: menuId } = await params;
  const { role_id } = await req.json();

  if (!role_id) {
    return NextResponse.json({ error: "role_id wajib diisi" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("role_menu_permissions").insert({
    id: uuid(),
    role_id,
    menu_id: menuId,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Role sudah memiliki akses menu ini" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Revoke role access from this menu
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: menuId } = await params;
  const { role_id } = await req.json();

  if (!role_id) {
    return NextResponse.json({ error: "role_id wajib diisi" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("role_menu_permissions")
    .delete()
    .eq("menu_id", menuId)
    .eq("role_id", role_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
