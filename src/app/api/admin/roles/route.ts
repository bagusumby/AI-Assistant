import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

// GET - List all roles
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("id, name, label, description, type, created_at")
    .order("type", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST - Create new role
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, label, description, type } = await req.json();

  if (!name || !label || !type) {
    return NextResponse.json({ error: "name, label, dan type wajib diisi" }, { status: 400 });
  }

  if (!["system", "manager", "user"].includes(type)) {
    return NextResponse.json({ error: "type harus system, manager, atau user" }, { status: 400 });
  }

  // Check name uniqueness
  const { data: existing } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("name", name)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Nama role sudah digunakan" }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from("roles").insert({
    id: uuid(),
    name,
    label,
    description: description || null,
    type,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
