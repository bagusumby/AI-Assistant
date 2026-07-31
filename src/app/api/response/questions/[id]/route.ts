import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// PUT - Update a question (admin only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const {
    section_id,
    question_text,
    question_type,
    scale_min,
    scale_max,
    scale_min_label,
    scale_max_label,
    is_required,
    sort_order,
  } = await req.json();

  if (!question_text || !question_type) {
    return NextResponse.json({ error: "Pertanyaan dan tipe wajib diisi" }, { status: 400 });
  }

  if (!["text", "scale"].includes(question_type)) {
    return NextResponse.json({ error: "Tipe pertanyaan tidak valid" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("response_questions")
    .update({
      ...(section_id ? { section_id } : {}),
      question_text,
      question_type,
      scale_min: question_type === "scale" ? (scale_min ?? 1) : null,
      scale_max: question_type === "scale" ? (scale_max ?? 5) : null,
      scale_min_label: question_type === "scale" ? (scale_min_label || null) : null,
      scale_max_label: question_type === "scale" ? (scale_max_label || null) : null,
      is_required: is_required ?? true,
      ...(typeof sort_order === "number" ? { sort_order } : {}),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Delete a question (cascades to its answers)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabaseAdmin.from("response_questions").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
