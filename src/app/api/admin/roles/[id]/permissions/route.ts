import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

// GET - Get menu IDs assigned to a role
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("role_menu_permissions")
    .select("menu_id")
    .eq("role_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data || []).map((r: { menu_id: string }) => r.menu_id));
}

// PUT - Replace all menu permissions for a role
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { menuIds } = await req.json();

  // Delete existing permissions
  const { error: delError } = await supabaseAdmin
    .from("role_menu_permissions")
    .delete()
    .eq("role_id", id);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  if (Array.isArray(menuIds) && menuIds.length > 0) {
    const inserts = menuIds.map((menuId: string) => ({
      id: uuid(),
      role_id: id,
      menu_id: menuId,
    }));
    const { error: insError } = await supabaseAdmin
      .from("role_menu_permissions")
      .insert(inserts);
    if (insError) {
      return NextResponse.json({ error: insError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
