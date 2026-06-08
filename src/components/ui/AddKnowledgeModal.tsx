"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AddKnowledgeModalProps {
  question: string;
  botId: string;
  botName?: string;
  sourceType: "unanswered" | "feedback";
  sourceId: string;
  initialAnswer?: string;
  replaceFilename?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TestResult {
  answer: string;
  sources: { filename: string; pageNumber: number; similarity: number }[];
}

export default function AddKnowledgeModal({
  question,
  botId,
  botName,
  sourceType,
  sourceId,
  initialAnswer = "",
  replaceFilename,
  onClose,
  onSuccess,
}: AddKnowledgeModalProps) {
  const [answer, setAnswer] = useState(initialAnswer);
  const isEditMode = !!replaceFilename;
  const [step, setStep] = useState<"form" | "success" | "testing" | "result">("form");
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ filename: string; chunks: number; similarResolved: number } | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleSubmit = async () => {
    if (!answer.trim()) {
      setError("Jawaban tidak boleh kosong");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reports/add-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          botId,
          sourceType,
          sourceId,
          replaceFilename: replaceFilename || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal menambahkan knowledge");
        return;
      }

      setUploadResult({ filename: data.filename, chunks: data.chunks, similarResolved: data.similarResolved || 0 });
      setStep("success");
      onSuccess?.();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setStep("testing");

    try {
      const res = await fetch("/api/reports/test-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          botId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal menguji knowledge");
        setStep("success");
        return;
      }

      setTestResult({ answer: data.answer, sources: data.sources });
      setStep("result");
    } catch {
      setError("Terjadi kesalahan jaringan saat testing");
      setStep("success");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">{isEditMode ? "Edit Knowledge Base" : "Tambah Knowledge Base"}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {botName && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{botName}</span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 text-xs">
                  {isEditMode
                    ? "Edit Jawaban Sebelumnya"
                    : sourceType === "unanswered" ? "Dari Pertanyaan Tak Terjawab" : "Dari Laporan Feedback"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 ml-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {/* Question (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Pertanyaan User
            </label>
            <div className="px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <p className="text-sm text-gray-200">{question}</p>
            </div>
          </div>

          {/* Step: Form */}
          {step === "form" && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                Jawaban yang Benar
              </label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Tulis jawaban yang seharusnya diberikan oleh AI..."
                rows={6}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none text-sm text-white placeholder:text-gray-600 resize-none transition-all"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Jawaban ini akan disimpan sebagai FAQ di knowledge base dan digunakan AI untuk menjawab pertanyaan serupa.
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && uploadResult && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-4 rounded-xl bg-green-500/10 border border-green-500/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-green-400">Berhasil!</span>
              </div>
              <p className="text-sm text-gray-300">
                {uploadResult.chunks} dokumen tersimpan sebagai <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">{uploadResult.filename}</code>
              </p>
              {uploadResult.similarResolved > 0 && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-xs text-indigo-300">
                    <span className="font-semibold">{uploadResult.similarResolved} pertanyaan serupa</span> juga otomatis ditandai sebagai terjawab.
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Klik &ldquo;Test Jawaban&rdquo; untuk memverifikasi bahwa AI sekarang dapat menjawab pertanyaan ini dengan benar.
              </p>
            </motion.div>
          )}

          {/* Step: Testing */}
          {step === "testing" && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-6 rounded-xl bg-white/5 border border-white/10 text-center"
            >
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-300">Menguji jawaban AI...</p>
              <p className="text-xs text-gray-500 mt-1">Menanyakan pertanyaan yang sama ke RAG system</p>
            </motion.div>
          )}

          {/* Step: Test Result */}
          {step === "result" && testResult && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* AI Answer */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                  Jawaban AI (Setelah Update)
                </label>
                <div className="px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{testResult.answer}</p>
                </div>
              </div>

              {/* Sources */}
              {testResult.sources.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                    Sumber Dokumen
                  </label>
                  <div className="space-y-1.5">
                    {testResult.sources.map((src, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                        <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-xs text-gray-300 flex-1 truncate">{src.filename}</span>
                        <span className="text-xs text-gray-500">Hal. {src.pageNumber}</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          src.similarity >= 0.7 ? "bg-green-500/20 text-green-400" :
                          src.similarity >= 0.5 ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-red-500/20 text-red-400"
                        }`}>
                          {(src.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verdict */}
              <div className={`px-4 py-3 rounded-xl border ${
                testResult.sources.some((s) => s.filename === uploadResult?.filename)
                  ? "bg-green-500/10 border-green-500/20"
                  : "bg-yellow-500/10 border-yellow-500/20"
              }`}>
                {testResult.sources.some((s) => s.filename === uploadResult?.filename) ? (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-green-400 font-medium">FAQ baru berhasil digunakan oleh AI</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <span className="text-sm text-yellow-400 font-medium">AI menjawab dari sumber lain. Periksa kembali jawaban di atas.</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
              >
                <p className="text-sm text-red-400">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex-shrink-0 flex items-center justify-end gap-3">
          {step === "form" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !answer.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {isEditMode ? "Mengupdate..." : "Menyimpan..."}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    {isEditMode ? "Update Knowledge Base" : "Submit ke Knowledge Base"}
                  </>
                )}
              </button>
            </>
          )}

          {step === "success" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-all"
              >
                Selesai
              </button>
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Menguji...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    Test Jawaban
                  </>
                )}
              </button>
            </>
          )}

          {step === "result" && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Selesai
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
