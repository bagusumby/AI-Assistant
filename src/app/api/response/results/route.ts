import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

interface QuestionStat {
  id: string;
  question_text: string;
  question_type: "text" | "scale";
  sort_order: number;
  scale_min?: number | null;
  scale_max?: number | null;
  average?: number;
  distribution?: { value: number; count: number }[];
  textAnswers?: { submissionId: string; createdAt: string; text: string }[];
}

interface SectionStat {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  questions: QuestionStat[];
}

// GET - Aggregated results for the dashboard (admin only)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: sections, error: secError }, { data: submissions, error: sError }] = await Promise.all([
    supabaseAdmin
      .from("response_sections")
      .select("*, response_questions(*)")
      .order("sort_order", { ascending: true })
      .order("sort_order", { ascending: true, foreignTable: "response_questions" }),
    supabaseAdmin
      .from("response_submissions")
      .select("id, created_at, response_answers(question_id, answer_text, answer_value)")
      .order("created_at", { ascending: false }),
  ]);

  if (secError) return NextResponse.json({ error: secError.message }, { status: 500 });
  if (sError) return NextResponse.json({ error: sError.message }, { status: 500 });

  const buildStat = (q: {
    id: string; question_text: string; question_type: "text" | "scale";
    sort_order: number; scale_min?: number | null; scale_max?: number | null;
  }): QuestionStat => {
    const base: QuestionStat = {
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      sort_order: q.sort_order,
      scale_min: q.scale_min,
      scale_max: q.scale_max,
    };

    if (q.question_type === "scale") {
      const min = q.scale_min ?? 1;
      const max = q.scale_max ?? 5;
      const counts = new Map<number, number>();
      for (let v = min; v <= max; v++) counts.set(v, 0);
      let sum = 0;
      let n = 0;
      for (const sub of submissions || []) {
        for (const ans of sub.response_answers || []) {
          if (ans.question_id === q.id && typeof ans.answer_value === "number") {
            counts.set(ans.answer_value, (counts.get(ans.answer_value) || 0) + 1);
            sum += ans.answer_value;
            n++;
          }
        }
      }
      base.average = n > 0 ? Number((sum / n).toFixed(2)) : 0;
      base.distribution = Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
    } else {
      const textAnswers: QuestionStat["textAnswers"] = [];
      for (const sub of submissions || []) {
        for (const ans of sub.response_answers || []) {
          if (ans.question_id === q.id && ans.answer_text) {
            textAnswers.push({ submissionId: sub.id, createdAt: sub.created_at, text: ans.answer_text });
          }
        }
      }
      base.textAnswers = textAnswers;
    }

    return base;
  };

  const sectionStats: SectionStat[] = (sections || []).map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    sort_order: s.sort_order,
    questions: (s.response_questions || []).map(buildStat),
  }));

  return NextResponse.json({
    totalSubmissions: submissions?.length || 0,
    sections: sectionStats,
  });
}

