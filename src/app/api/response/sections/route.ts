import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

// GET - List sections with their questions, ordered (public, used by the survey form)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("response_sections")
    .select("*, response_questions(*)")
    .order("sort_order", { ascending: true })
    .order("sort_order", { ascending: true, foreignTable: "response_questions" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST - Create a new section (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Judul section wajib diisi" }, { status: 400 });
  }

  const { data: maxRow } = await supabaseAdmin
    .from("response_sections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabaseAdmin.from("response_sections").insert({
    id: uuid(),
    title,
    description: description || null,
    sort_order: nextOrder,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
