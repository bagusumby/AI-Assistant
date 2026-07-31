import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

// POST - Submit survey answers (public, no auth - shared link for respondents)
export async function POST(req: NextRequest) {
  const { answers } = await req.json();

  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: "Jawaban tidak boleh kosong" }, { status: 400 });
  }

  const { data: questions, error: qError } = await supabaseAdmin
    .from("response_questions")
    .select("id, question_type, is_required")
    .not("section_id", "is", null); // abaikan pertanyaan yatim tanpa section (tidak tampil di form publik)

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  const answerByQuestion = new Map<string, { answer_text?: string; answer_value?: number }>(
    answers.map((a: { questionId: string; text?: string; value?: number }) => [
      a.questionId,
      { answer_text: a.text, answer_value: a.value },
    ])
  );

  // Validate required questions are answered
  for (const q of questions || []) {
    if (!q.is_required) continue;
    const ans = answerByQuestion.get(q.id);
    const answered =
      q.question_type === "scale"
        ? typeof ans?.answer_value === "number"
        : !!ans?.answer_text?.trim();
    if (!answered) {
      return NextResponse.json({ error: "Mohon lengkapi semua pertanyaan wajib" }, { status: 400 });
    }
  }

  const submissionId = uuid();
  const { error: subError } = await supabaseAdmin
    .from("response_submissions")
    .insert({ id: submissionId });

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  const rows = (questions || [])
    .filter((q) => answerByQuestion.has(q.id))
    .map((q) => {
      const ans = answerByQuestion.get(q.id)!;
      return {
        id: uuid(),
        submission_id: submissionId,
        question_id: q.id,
        answer_text: q.question_type === "text" ? (ans.answer_text?.trim() || null) : null,
        answer_value: q.question_type === "scale" ? (ans.answer_value ?? null) : null,
      };
    });

  if (rows.length > 0) {
    const { error: ansError } = await supabaseAdmin.from("response_answers").insert(rows);
    if (ansError) {
      return NextResponse.json({ error: ansError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
