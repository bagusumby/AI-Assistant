import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

// GET - List questions ordered by sort_order (public, used by the survey form)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("response_questions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST - Create a new question (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    section_id,
    question_text,
    question_type,
    scale_min,
    scale_max,
    scale_min_label,
    scale_max_label,
    is_required,
  } = await req.json();

  if (!section_id) {
    return NextResponse.json({ error: "Section wajib dipilih" }, { status: 400 });
  }

  if (!question_text || !question_type) {
    return NextResponse.json({ error: "Pertanyaan dan tipe wajib diisi" }, { status: 400 });
  }

  if (!["text", "scale"].includes(question_type)) {
    return NextResponse.json({ error: "Tipe pertanyaan tidak valid" }, { status: 400 });
  }

  const { data: maxRow } = await supabaseAdmin
    .from("response_questions")
    .select("sort_order")
    .eq("section_id", section_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabaseAdmin.from("response_questions").insert({
    id: uuid(),
    section_id,
    question_text,
    question_type,
    scale_min: question_type === "scale" ? (scale_min ?? 1) : null,
    scale_max: question_type === "scale" ? (scale_max ?? 5) : null,
    scale_min_label: question_type === "scale" ? (scale_min_label || null) : null,
    scale_max_label: question_type === "scale" ? (scale_max_label || null) : null,
    is_required: is_required ?? true,
    sort_order: nextOrder,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

