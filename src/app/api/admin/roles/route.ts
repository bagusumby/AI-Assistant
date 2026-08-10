import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

// GET - List all roles (plain array), or filtered & paginated when `page` query param is present
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const paginated = searchParams.has("page");

  if (!paginated) {
    const { data, error } = await supabaseAdmin
      .from("roles")
      .select("id, name, label, description, type, created_at")
      .order("type", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  }

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
  const name = searchParams.get("name")?.trim();
  const label = searchParams.get("label")?.trim();
  const type = searchParams.get("type")?.trim();

  let query = supabaseAdmin
    .from("roles")
    .select("id, name, label, description, type, created_at", { count: "exact" });

  if (name) query = query.ilike("name", `%${name}%`);
  if (label) query = query.ilike("label", `%${label}%`);
  if (type) query = query.eq("type", type);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query
    .order("type", { ascending: true })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    roles: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  });
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
