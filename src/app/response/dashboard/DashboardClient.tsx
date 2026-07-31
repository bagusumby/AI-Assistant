"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface QuestionStat {
  id: string;
  question_text: string;
  question_type: "text" | "scale";
  average?: number;
  distribution?: { value: number; count: number }[];
  textAnswers?: { submissionId: string; createdAt: string; text: string }[];
}

interface SectionStat {
  id: string;
  title: string;
  description: string | null;
  questions: QuestionStat[];
}

interface ResultsData {
  totalSubmissions: number;
  sections: SectionStat[];
}

interface SubmissionAnswer {
  id: string;
  question_id: string;
  answer_text: string | null;
  answer_value: number | null;
  response_questions: { question_text: string; question_type: "text" | "scale" } | null;
}

interface Submission {
  id: string;
  created_at: string;
  response_answers: SubmissionAnswer[];
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">Nilai {label}</p>
      <p className="text-indigo-300 font-semibold">{payload[0].value} responden</p>
    </div>
  );
}

export default function DashboardClient() {
  const [results, setResults] = useState<ResultsData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [resResults, resSubs] = await Promise.all([
      fetch("/api/response/results"),
      fetch("/api/response/submissions"),
    ]);
    if (resResults.ok) setResults(await resResults.json());
    if (resSubs.ok) setSubmissions(await resSubs.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus data responden ini? Tindakan ini tidak dapat dibatalkan.")) return;
    const res = await fetch(`/api/response/submissions/${id}`, { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  return (
    <div className="h-screen overflow-y-auto p-6 bg-gray-950">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Dashboard Response Survey</h1>
            <p className="text-gray-400 text-sm">Ringkasan jawaban responden dari halaman /response</p>
          </div>
          <div className="glass rounded-xl border border-white/10 px-5 py-3 text-center">
            <p className="text-2xl font-bold text-white">{results?.totalSubmissions ?? "—"}</p>
            <p className="text-xs text-gray-400">Total Responden</p>
          </div>
        </div>

        {loading ? (
          <div className="glass rounded-xl border border-white/10 p-10 text-center text-gray-500 text-sm">Memuat data...</div>
        ) : !results || results.totalSubmissions === 0 ? (
          <div className="glass rounded-xl border border-white/10 p-10 text-center text-gray-500 text-sm">Belum ada responden yang mengisi survey</div>
        ) : (
          <>
            {results.sections.map((section) => (
              <div key={section.id} className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-white uppercase tracking-wide">{section.title}</h2>
                  {section.description && <p className="text-xs text-gray-500">{section.description}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {section.questions.map((q) => (
                    <div key={q.id} className="glass rounded-xl border border-white/5 p-5">
                      <p className="text-sm font-medium text-white mb-3">{q.question_text}</p>

                      {q.question_type === "scale" ? (
                        <>
                          <p className="text-xs text-gray-400 mb-2">
                            Rata-rata: <span className="text-indigo-300 font-semibold">{q.average}</span> / 5
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={q.distribution} margin={{ left: -16, right: 8, top: 4, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                              <XAxis dataKey="value" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                              <Tooltip content={<ChartTooltip />} />
                              <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                          {!q.textAnswers?.length ? (
                            <p className="text-xs text-gray-500">Belum ada jawaban</p>
                          ) : (
                            q.textAnswers.map((a, i) => (
                              <div key={i} className="text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-2">
                                {a.text}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="font-semibold text-white text-sm">Daftar Responden ({submissions.length})</h2>
              </div>
              <div className="divide-y divide-white/5">
                {submissions.map((sub) => (
                  <div key={sub.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                        className="flex-1 text-left text-sm text-gray-300 hover:text-white transition-colors"
                      >
                        {new Date(sub.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        <span className="text-gray-500 ml-2">{expandedId === sub.id ? "▲ sembunyikan" : "▼ lihat jawaban"}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all flex-shrink-0"
                      >
                        Hapus
                      </button>
                    </div>
                    {expandedId === sub.id && (
                      <div className="mt-3 space-y-2 pl-1">
                        {sub.response_answers.map((a) => (
                          <div key={a.id} className="text-xs">
                            <span className="text-gray-500">{a.response_questions?.question_text}: </span>
                            <span className="text-gray-200 font-medium">
                              {a.answer_text ?? a.answer_value ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
