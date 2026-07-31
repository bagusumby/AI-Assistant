"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ResponseSectionWithQuestions } from "@/types";

type AnswerMap = Record<string, { text?: string; value?: number }>;

const DRAFT_KEY = "response_survey_draft";

export default function ResponseFormPage() {
  const [sections, setSections] = useState<ResponseSectionWithQuestions[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [draftPrompt, setDraftPrompt] = useState<AnswerMap | null>(null);
  const [draftResolved, setDraftResolved] = useState(false);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/response/sections");
    if (res.ok) setSections(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSections();

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const parsed = raw ? (JSON.parse(raw) as AnswerMap) : null;
      if (parsed && Object.keys(parsed).length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraftPrompt(parsed);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraftResolved(true);
      }
    } catch {
      setDraftResolved(true);
    }
  }, [fetchSections]);

  // Simpan jawaban ke localStorage supaya tidak hilang saat refresh, sampai berhasil submit
  useEffect(() => {
    if (!draftResolved) return;
    try {
      if (Object.keys(answers).length > 0) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // localStorage tidak tersedia, abaikan
    }
  }, [answers, draftResolved]);

  const resumeDraft = () => {
    if (draftPrompt) setAnswers(draftPrompt);
    setDraftPrompt(null);
    setDraftResolved(true);
  };

  const discardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // abaikan
    }
    setDraftPrompt(null);
    setDraftResolved(true);
  };

  const allQuestions = useMemo(() => sections.flatMap((s) => s.response_questions), [sections]);
  const requiredQuestions = useMemo(() => allQuestions.filter((q) => q.is_required), [allQuestions]);
  const answeredRequiredCount = useMemo(() => {
    return requiredQuestions.filter((q) => {
      const ans = answers[q.id];
      return q.question_type === "scale" ? typeof ans?.value === "number" : !!ans?.text?.trim();
    }).length;
  }, [requiredQuestions, answers]);
  const progress = requiredQuestions.length > 0 ? (answeredRequiredCount / requiredQuestions.length) * 100 : 0;

  const setText = (id: string, text: string) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], text } }));

  const setValue = (id: string, value: number) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], value } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    for (const q of allQuestions) {
      if (!q.is_required) continue;
      const ans = answers[q.id];
      const answered = q.question_type === "scale" ? typeof ans?.value === "number" : !!ans?.text?.trim();
      if (!answered) {
        setError("Mohon lengkapi semua pertanyaan yang wajib diisi.");
        return;
      }
    }

    setSubmitting(true);
    const payload = {
      answers: allQuestions.map((q) => ({
        questionId: q.id,
        text: answers[q.id]?.text,
        value: answers[q.id]?.value,
      })),
    };

    const res = await fetch("/api/response/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Gagal mengirim jawaban. Silakan coba lagi.");
      return;
    }

    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // abaikan
    }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <AnimatePresence>
        {draftPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="bg-white rounded-2xl shadow-xl shadow-slate-300/40 max-w-sm w-full p-6"
            >
              <h2 className="text-base font-semibold text-slate-800 mb-2">Lanjutkan pengisian sebelumnya?</h2>
              <p className="text-sm text-slate-500 mb-6">Kami menemukan jawaban yang belum Anda kirim. Ingin melanjutkan pengisian tersebut?</p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={discardDraft}
                  className="px-4 py-2 rounded-full text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Tidak, mulai baru
                </button>
                <button
                  type="button"
                  onClick={resumeDraft}
                  className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium shadow-md shadow-indigo-200 transition-all"
                >
                  Ya, lanjutkan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!submitted && !loading && allQuestions.length > 0 && (
        <div className="sticky top-0 z-20 h-1 bg-slate-100">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10 pb-28">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="text-center py-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 16 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200"
              >
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <h1 className="text-2xl font-semibold text-slate-800 mb-2">Terima kasih atas tanggapan Anda!</h1>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">Jawaban Anda sudah tersimpan dan sangat berarti bagi kami.</p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setAnswers({});
                  try {
                    localStorage.removeItem(DRAFT_KEY);
                  } catch {
                    // abaikan
                  }
                }}
                className="mt-8 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm"
              >
                Kirim tanggapan lain
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={handleSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 p-8 mb-8 shadow-xl shadow-indigo-200/60 text-white"
              >
                <span className="inline-block text-xs font-medium tracking-wide uppercase bg-white/15 rounded-full px-3 py-1 mb-3">
                  Survey Kepuasan Pengguna
                </span>
                <h1 className="text-2xl font-semibold mb-2">Bagaimana pengalaman Anda?</h1>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  Mohon luangkan waktu sejenak untuk mengisi survey ini. Masukan Anda membantu kami meningkatkan kualitas layanan.
                </p>
              </motion.div>

              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-sm shadow-slate-100 p-6">
                      <div className="h-4 bg-slate-100 rounded-full animate-pulse w-1/2 mb-4" />
                      <div className="h-9 bg-slate-100 rounded-xl animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                sections.map((section, sIdx) => (
                  <div key={section.id} className="mb-9">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-semibold flex items-center justify-center shadow-sm shadow-indigo-200 flex-shrink-0">
                        {sIdx + 1}
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-slate-800">{section.title}</h2>
                        {section.description && <p className="text-xs text-slate-500">{section.description}</p>}
                      </div>
                    </div>

                    <div className="space-y-4 pl-11 border-l-2 border-dashed border-indigo-100 -ml-[1px]">
                      {section.response_questions.map((q) => (
                        <motion.div
                          key={q.id}
                          whileHover={{ y: -2 }}
                          className="bg-white rounded-2xl shadow-sm shadow-slate-100 hover:shadow-md hover:shadow-indigo-100 border border-slate-100 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 p-6 transition-all ml-4"
                        >
                          <label className="block text-sm font-medium text-slate-700 mb-4">
                            {q.question_text}
                            {q.is_required && <span className="text-pink-500 ml-1">*</span>}
                          </label>

                          {q.question_type === "text" ? (
                            <input
                              type="text"
                              value={answers[q.id]?.text || ""}
                              onChange={(e) => setText(q.id, e.target.value)}
                              placeholder="Ketik jawaban Anda..."
                              className="w-full rounded-xl bg-slate-50 focus:bg-white border border-transparent focus:border-indigo-300 outline-none px-4 py-2.5 text-sm text-slate-800 transition-colors"
                            />
                          ) : (
                            <div>
                              <div className="flex items-center justify-between gap-1.5">
                                {Array.from(
                                  { length: (q.scale_max ?? 5) - (q.scale_min ?? 1) + 1 },
                                  (_, i) => (q.scale_min ?? 1) + i
                                ).map((val) => {
                                  const selected = answers[q.id]?.value === val;
                                  return (
                                    <motion.button
                                      key={val}
                                      type="button"
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => setValue(q.id, val)}
                                      className={`flex-1 aspect-square rounded-xl text-sm font-semibold border transition-all ${
                                        selected
                                          ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white border-transparent shadow-md shadow-indigo-200 scale-105"
                                          : "bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                                      }`}
                                    >
                                      {val}
                                    </motion.button>
                                  );
                                })}
                              </div>
                              {(q.scale_min_label || q.scale_max_label) && (
                                <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                                  <span>{q.scale_min_label}</span>
                                  <span>{q.scale_max_label}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {error && (
                <div className="bg-pink-50 border border-pink-200 text-pink-600 text-sm rounded-xl px-4 py-3 mb-4">
                  {error}
                </div>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {!submitted && !loading && allQuestions.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/80 backdrop-blur-md border-t border-slate-100">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              {answeredRequiredCount}/{requiredQuestions.length} pertanyaan wajib terisi
            </p>
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              whileHover={{ scale: submitting ? 1 : 1.03 }}
              whileTap={{ scale: submitting ? 1 : 0.97 }}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white text-sm font-medium shadow-md shadow-indigo-200 transition-all"
            >
              {submitting ? "Mengirim..." : "Kirim Jawaban"}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
