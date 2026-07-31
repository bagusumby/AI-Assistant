"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ResponseQuestionType, ResponseSectionWithQuestions } from "@/types";

interface QuestionForm {
  section_id: string;
  question_text: string;
  question_type: ResponseQuestionType;
  is_required: boolean;
  scale_min: number;
  scale_max: number;
  scale_min_label: string;
  scale_max_label: string;
}

const emptyQuestionForm = (sectionId: string): QuestionForm => ({
  section_id: sectionId,
  question_text: "",
  question_type: "text",
  is_required: true,
  scale_min: 1,
  scale_max: 5,
  scale_min_label: "",
  scale_max_label: "",
});

export default function ConfigClient() {
  const [sections, setSections] = useState<ResponseSectionWithQuestions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Section form modal
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: "", description: "" });

  // Question form modal
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm(""));

  const fetchSections = useCallback(async () => {
    const res = await fetch("/api/response/sections");
    if (res.ok) setSections(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSections();
  }, [fetchSections]);

  // ── Section actions ──────────────────────────────────────────────────
  const openCreateSection = () => {
    setEditingSectionId(null);
    setSectionForm({ title: "", description: "" });
    setError("");
    setShowSectionForm(true);
  };

  const openEditSection = (s: ResponseSectionWithQuestions) => {
    setEditingSectionId(s.id);
    setSectionForm({ title: s.title, description: s.description || "" });
    setError("");
    setShowSectionForm(true);
  };

  const handleSaveSection = async () => {
    if (!sectionForm.title.trim()) {
      setError("Judul section wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    const url = editingSectionId ? `/api/response/sections/${editingSectionId}` : "/api/response/sections";
    const method = editingSectionId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sectionForm),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan section");
      return;
    }
    setShowSectionForm(false);
    fetchSections();
  };

  const handleDeleteSection = async (id: string) => {
    if (!confirm("Yakin ingin menghapus section ini? Semua pertanyaan di dalamnya juga akan terhapus.")) return;
    const res = await fetch(`/api/response/sections/${id}`, { method: "DELETE" });
    if (res.ok) fetchSections();
  };

  const handleReorderSection = async (index: number, direction: -1 | 1) => {
    const target = sections[index + direction];
    const current = sections[index];
    if (!target) return;
    await Promise.all([
      fetch(`/api/response/sections/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: current.title, description: current.description, sort_order: target.sort_order }),
      }),
      fetch(`/api/response/sections/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: target.title, description: target.description, sort_order: current.sort_order }),
      }),
    ]);
    fetchSections();
  };

  // ── Question actions ─────────────────────────────────────────────────
  const openCreateQuestion = (sectionId: string) => {
    setEditingQuestionId(null);
    setQuestionForm(emptyQuestionForm(sectionId));
    setError("");
    setShowQuestionForm(true);
  };

  const openEditQuestion = (sectionId: string, q: ResponseSectionWithQuestions["response_questions"][number]) => {
    setEditingQuestionId(q.id);
    setQuestionForm({
      section_id: sectionId,
      question_text: q.question_text,
      question_type: q.question_type,
      is_required: q.is_required,
      scale_min: q.scale_min ?? 1,
      scale_max: q.scale_max ?? 5,
      scale_min_label: q.scale_min_label || "",
      scale_max_label: q.scale_max_label || "",
    });
    setError("");
    setShowQuestionForm(true);
  };

  const handleSaveQuestion = async () => {
    if (!questionForm.question_text.trim()) {
      setError("Pertanyaan wajib diisi");
      return;
    }
    setSaving(true);
    setError("");
    const url = editingQuestionId ? `/api/response/questions/${editingQuestionId}` : "/api/response/questions";
    const method = editingQuestionId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questionForm),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Gagal menyimpan pertanyaan");
      return;
    }
    setShowQuestionForm(false);
    fetchSections();
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Yakin ingin menghapus pertanyaan ini? Jawaban terkait juga akan terhapus.")) return;
    const res = await fetch(`/api/response/questions/${id}`, { method: "DELETE" });
    if (res.ok) fetchSections();
  };

  const handleReorderQuestion = async (section: ResponseSectionWithQuestions, index: number, direction: -1 | 1) => {
    const questions = section.response_questions;
    const target = questions[index + direction];
    const current = questions[index];
    if (!target) return;

    const buildBody = (q: typeof current, sortOrder: number) => ({
      section_id: section.id,
      question_text: q.question_text,
      question_type: q.question_type,
      is_required: q.is_required,
      scale_min: q.scale_min,
      scale_max: q.scale_max,
      scale_min_label: q.scale_min_label,
      scale_max_label: q.scale_max_label,
      sort_order: sortOrder,
    });

    await Promise.all([
      fetch(`/api/response/questions/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(current, target.sort_order)),
      }),
      fetch(`/api/response/questions/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(target, current.sort_order)),
      }),
    ]);
    fetchSections();
  };

  return (
    <div className="h-screen overflow-y-auto p-6 bg-gray-950">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Konfigurasi Survey Response</h1>
            <p className="text-gray-400 text-sm">Kelola section dan pertanyaan yang tampil di halaman /response</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreateSection}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-medium text-sm transition-all"
          >
            + Tambah Section
          </motion.button>
        </div>

        {loading ? (
          <div className="glass rounded-xl border border-white/10 p-8 text-center text-gray-500 text-sm">Memuat...</div>
        ) : sections.length === 0 ? (
          <div className="glass rounded-xl border border-white/10 p-8 text-center text-gray-500 text-sm">Belum ada section</div>
        ) : (
          <div className="space-y-5">
            {sections.map((section, sIdx) => (
              <div key={section.id} className="glass rounded-xl border border-white/10 overflow-hidden">
                <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                        {sIdx + 1}
                      </span>
                      <h2 className="text-white font-semibold text-sm truncate">{section.title}</h2>
                    </div>
                    {section.description && <p className="text-xs text-gray-500 mt-1 pl-8">{section.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleReorderSection(sIdx, -1)} disabled={sIdx === 0} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">↑</button>
                    <button onClick={() => handleReorderSection(sIdx, 1)} disabled={sIdx === sections.length - 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">↓</button>
                    <button onClick={() => openEditSection(section)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all">Edit</button>
                    <button onClick={() => handleDeleteSection(section.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all">Hapus</button>
                  </div>
                </div>

                <div className="divide-y divide-white/5">
                  {section.response_questions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">Belum ada pertanyaan di section ini</div>
                  ) : (
                    section.response_questions.map((q, qIdx) => (
                      <div key={q.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.question_type === "scale" ? "bg-purple-500/20 text-purple-300" : "bg-indigo-500/20 text-indigo-300"}`}>
                              {q.question_type === "scale" ? "Skala 1-5" : "Input Teks"}
                            </span>
                            {q.is_required && <span className="text-xs text-red-400">Wajib</span>}
                          </div>
                          <p className="text-sm text-white font-medium truncate">{q.question_text}</p>
                          {q.question_type === "scale" && (q.scale_min_label || q.scale_max_label) && (
                            <p className="text-xs text-gray-500 mt-1">{q.scale_min_label} → {q.scale_max_label}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleReorderQuestion(section, qIdx, -1)} disabled={qIdx === 0} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">↑</button>
                          <button onClick={() => handleReorderQuestion(section, qIdx, 1)} disabled={qIdx === section.response_questions.length - 1} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">↓</button>
                          <button onClick={() => openEditQuestion(section.id, q)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all">Edit</button>
                          <button onClick={() => handleDeleteQuestion(q.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all">Hapus</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-3 bg-white/[0.02]">
                  <button
                    onClick={() => openCreateQuestion(section.id)}
                    className="w-full text-xs text-indigo-300 hover:text-indigo-200 py-1.5 rounded-lg hover:bg-white/5 transition-all"
                  >
                    + Tambah Pertanyaan ke Section Ini
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Section modal */}
      <AnimatePresence>
        {showSectionForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSectionForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl border border-white/10 p-6 w-full max-w-lg"
            >
              <h2 className="text-lg font-semibold text-white mb-4">
                {editingSectionId ? "Edit Section" : "Tambah Section"}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Judul Section</label>
                  <input
                    type="text"
                    value={sectionForm.title}
                    onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                    placeholder="Contoh: Kemudahan Pengguna"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Deskripsi (opsional)</label>
                  <input
                    type="text"
                    value={sectionForm.description}
                    onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                    placeholder="Deskripsi singkat section"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={() => setShowSectionForm(false)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all">Batal</button>
                  <button onClick={handleSaveSection} disabled={saving} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-sm font-medium text-white transition-all">
                    {saving ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question modal */}
      <AnimatePresence>
        {showQuestionForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowQuestionForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl border border-white/10 p-6 w-full max-w-lg"
            >
              <h2 className="text-lg font-semibold text-white mb-4">
                {editingQuestionId ? "Edit Pertanyaan" : "Tambah Pertanyaan"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Section</label>
                  <select
                    value={questionForm.section_id}
                    onChange={(e) => setQuestionForm({ ...questionForm, section_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-indigo-500"
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id} className="bg-gray-900">{s.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Teks Pertanyaan</label>
                  <input
                    type="text"
                    value={questionForm.question_text}
                    onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                    placeholder="Contoh: Nama Anda"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Tipe Pertanyaan</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, question_type: "text" })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${questionForm.question_type === "text" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" : "bg-white/5 text-gray-400 border border-white/10"}`}
                    >
                      Input Teks
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, question_type: "scale" })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${questionForm.question_type === "scale" ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "bg-white/5 text-gray-400 border border-white/10"}`}
                    >
                      Skala (1-5)
                    </button>
                  </div>
                </div>

                {questionForm.question_type === "scale" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Label Nilai Minimum (opsional)</label>
                      <input
                        type="text"
                        value={questionForm.scale_min_label}
                        onChange={(e) => setQuestionForm({ ...questionForm, scale_min_label: e.target.value })}
                        placeholder="Sangat Tidak Puas"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Label Nilai Maksimum (opsional)</label>
                      <input
                        type="text"
                        value={questionForm.scale_max_label}
                        onChange={(e) => setQuestionForm({ ...questionForm, scale_max_label: e.target.value })}
                        placeholder="Sangat Puas"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={questionForm.is_required}
                    onChange={(e) => setQuestionForm({ ...questionForm, is_required: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  Wajib diisi
                </label>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={() => setShowQuestionForm(false)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all">Batal</button>
                  <button onClick={handleSaveQuestion} disabled={saving} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-sm font-medium text-white transition-all">
                    {saving ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
