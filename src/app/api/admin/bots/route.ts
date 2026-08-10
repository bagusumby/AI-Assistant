import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

// GET - List all AI bots (plain array), or filtered & paginated when `page` query param is present
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const paginated = searchParams.has("page");

  if (!paginated) {
    const { data, error } = await supabaseAdmin
      .from("ai_bots")
      .select("id, name, slug, description, chat_enabled, system_prompt, created_at, manager_role_id, roles(id, name, label)")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  }

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
  const name = searchParams.get("name")?.trim();
  const slug = searchParams.get("slug")?.trim();

  let query = supabaseAdmin
    .from("ai_bots")
    .select("id, name, slug, description, chat_enabled, system_prompt, created_at, manager_role_id, roles(id, name, label)", { count: "exact" });

  if (name) query = query.ilike("name", `%${name}%`);
  if (slug) query = query.ilike("slug", `%${slug}%`);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    bots: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  });
}

// POST - Create new AI bot
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, slug, description, manager_role_id, chat_enabled, system_prompt } = await req.json();

  if (!name || !slug) {
    return NextResponse.json({ error: "name dan slug wajib diisi" }, { status: 400 });
  }

  // Check slug uniqueness
  const { data: existing } = await supabaseAdmin
    .from("ai_bots")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Slug sudah digunakan" }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from("ai_bots").insert({
    id: uuid(),
    name,
    slug,
    description: description || null,
    manager_role_id: manager_role_id || null,
    chat_enabled: chat_enabled ?? true,
    system_prompt: system_prompt || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
