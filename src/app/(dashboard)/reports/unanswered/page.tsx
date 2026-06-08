"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import type { UnansweredQuestion } from "@/types";
import AddKnowledgeModal from "@/components/ui/AddKnowledgeModal";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface DetailModalProps {
  question: UnansweredQuestion;
  onClose: () => void;
  onRefresh?: () => void;
}

function DetailModal({ question, onClose, onRefresh }: DetailModalProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/reports/session/${question.session_id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [question.session_id]);

  const isResolved = !!question.resolved_at;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isResolved ? "bg-green-500/20" : "bg-orange-500/20"}`}>
              {isResolved ? (
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">
                {isResolved ? "Pertanyaan Sudah Terjawab" : "Detail Percakapan"}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-gray-400">{question.users?.name || question.users?.email || "-"}</span>
                {question.ai_bots?.name && (
                  <>
                    <span className="text-gray-600 text-xs">•</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{question.ai_bots.name}</span>
                  </>
                )}
                <span className="text-gray-600 text-xs">•</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${isResolved ? "bg-green-500/20 text-green-300" : "bg-orange-500/20 text-orange-300"}`}>
                  {isResolved ? "Sudah Terjawab" : "Tidak Terjawab"}
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

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {/* Question highlight */}
          <div className="px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <p className="text-xs font-semibold text-orange-400 mb-1">Pertanyaan User</p>
            <p className="text-sm text-gray-300">{question.question}</p>
          </div>

          {/* Resolved answer section */}
          {isResolved && question.resolved_answer && (
            <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-green-400">Jawaban yang Sudah Diperbaiki</p>
                {question.resolved_filename && (
                  <span className="text-xs text-gray-500">{question.resolved_filename}</span>
                )}
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{question.resolved_answer}</p>
            </div>
          )}

          {/* Original bot response */}
          <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs font-semibold text-gray-500 mb-1">Jawaban Bot Sebelumnya</p>
            <p className="text-sm text-gray-400 italic">{question.bot_response}</p>
          </div>

          {/* Chat messages (collapsible for resolved) */}
          {!isResolved && (
            <>
              <div className="border-t border-white/5 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-3">Riwayat Percakapan</p>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                      <div className="h-12 w-48 rounded-2xl bg-white/5 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-gray-500 text-sm">
                  Tidak ada pesan dalam sesi ini
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={msg.id || i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-md"
                          : "bg-white/5 border border-white/10 text-gray-200 rounded-bl-md"
                      } ${
                        msg.role === "assistant" && msg.content === question.bot_response
                          ? "ring-2 ring-orange-500/50"
                          : ""
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {isResolved
              ? `Dijawab pada ${new Date(question.resolved_at!).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}`
              : `Tercatat pada ${new Date(question.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}`
            }
          </p>
          <div className="flex items-center gap-2">
            {isResolved ? (
              <button
                onClick={() => { setIsEditing(true); setShowAddKnowledge(true); }}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Edit Jawaban
              </button>
            ) : (
              <button
                onClick={() => { setIsEditing(false); setShowAddKnowledge(true); }}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-xs font-medium transition-all flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Tambah Jawaban
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Add/Edit Knowledge Modal */}
      <AnimatePresence>
        {showAddKnowledge && (
          <AddKnowledgeModal
            question={question.question}
            botId={question.ai_bot_id}
            botName={question.ai_bots?.name}
            sourceType="unanswered"
            sourceId={question.id}
            initialAnswer={isEditing ? (question.resolved_answer || "") : ""}
            replaceFilename={isEditing ? (question.resolved_filename || undefined) : undefined}
            onClose={() => setShowAddKnowledge(false)}
            onSuccess={() => onRefresh?.()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function UnansweredQuestionsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBot, setFilterBot] = useState<string>("all");
  const [selectedQuestion, setSelectedQuestion] = useState<UnansweredQuestion | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [sortBy, setSortBy] = useState<"priority" | "date">("priority");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showMarkResolvedModal, setShowMarkResolvedModal] = useState(false);
  const [markResolvedAnswer, setMarkResolvedAnswer] = useState("");

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("status", activeTab);
    params.set("sort", sortBy);
    if (filterPriority !== "all") params.set("priority", filterPriority);
    const res = await fetch(`/api/reports/unanswered?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setQuestions(data);
    }
    setLoading(false);
  }, [activeTab, sortBy, filterPriority]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const uniqueBots = Array.from(
    new Map(questions.filter((q) => q.ai_bots).map((q) => [q.ai_bots!.id, q.ai_bots!])).values()
  );

  const filtered = filterBot === "all" ? questions : questions.filter((q) => q.ai_bots?.id === filterBot);

  const setPriority = async (id: string, priority: string | null) => {
    await fetch("/api/reports/unanswered", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, priority }),
    });
    fetchQuestions();
  };

  const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    high: { label: "High", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
    medium: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
    low: { label: "Low", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((q) => q.id)));
    }
  };

  const handleBulkMarkResolved = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await fetch("/api/reports/add-knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          sourceType: "unanswered",
          resolvedAnswer: markResolvedAnswer.trim() || null,
        }),
      });
      setSelectedIds(new Set());
      setShowMarkResolvedModal(false);
      setMarkResolvedAnswer("");
      fetchQuestions();
    } catch {
      // silently fail
    }
    setBulkLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <AnimatePresence>
        {selectedQuestion && (
          <DetailModal key="detail-modal" question={selectedQuestion} onClose={() => setSelectedQuestion(null)} onRefresh={fetchQuestions} />
        )}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Pertanyaan Tak Terjawab</h1>
            <p className="text-gray-400 text-sm mt-1">
              {isAdmin
                ? "Semua pertanyaan yang tidak dapat dijawab oleh AI dari dokumen yang tersedia"
                : "Pertanyaan yang tidak dapat dijawab oleh AI Bot Anda"}
            </p>
          </div>
          <button
            onClick={fetchQuestions}
            className="px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-6 p-1 glass rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "pending"
                ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Belum Terjawab
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "resolved"
                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Sudah Terjawab
          </button>
        </div>

        {/* Controls: Sort + Priority Filter + Bot Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "priority" | "date")}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="priority" className="bg-gray-900">Priority</option>
              <option value="date" className="bg-gray-900">Terbaru</option>
            </select>
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Priority:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setFilterPriority("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  filterPriority === "all" ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/30" : "border border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                Semua
              </button>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setFilterPriority(key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    filterPriority === key ? `${cfg.bg} ${cfg.color}` : "border border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
              <button
                onClick={() => setFilterPriority("unset")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  filterPriority === "unset" ? "bg-gray-500/30 text-gray-300 border border-gray-500/30" : "border border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                Belum Di-set
              </button>
            </div>
          </div>

          {/* Bot filter (admin only) */}
          {isAdmin && uniqueBots.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Bot:</span>
              <select
                value={filterBot}
                onChange={(e) => setFilterBot(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-indigo-500"
              >
                <option value="all" className="bg-gray-900">Semua Bot</option>
                {uniqueBots.map((bot) => (
                  <option key={bot.id} value={bot.id} className="bg-gray-900">{bot.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Bulk action bar + Stats */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-500">
            Menampilkan {filtered.length} pertanyaan
          </span>
          {activeTab === "pending" && selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{selectedIds.size} dipilih</span>
              <button
                onClick={() => setShowMarkResolvedModal(true)}
                disabled={bulkLoading}
                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tandai Terjawab
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white text-xs transition-all"
              >
                Batal
              </button>
            </div>
          )}
        </div>

        {/* Mark Resolved Modal */}
        <AnimatePresence>
          {showMarkResolvedModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass border border-white/10 rounded-2xl w-full max-w-lg p-6"
              >
                <h3 className="text-white font-semibold text-sm mb-1">Tandai {selectedIds.size} Pertanyaan Sebagai Terjawab</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Pertanyaan yang dipilih akan ditandai sebagai sudah terjawab. Opsional: tuliskan jawaban atau referensi kenapa pertanyaan ini sudah ter-cover.
                </p>

                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1.5">Jawaban / Keterangan (opsional)</label>
                  <textarea
                    value={markResolvedAnswer}
                    onChange={(e) => setMarkResolvedAnswer(e.target.value)}
                    placeholder="Contoh: Sudah dijawab oleh FAQ tentang prosedur pendaftaran..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none text-sm text-white placeholder:text-gray-600 resize-none"
                  />
                </div>

                <div className="mb-4 max-h-40 overflow-y-auto space-y-1.5">
                  <p className="text-xs text-gray-500 font-medium mb-1">Pertanyaan yang akan ditandai:</p>
                  {filtered.filter((q) => selectedIds.has(q.id)).map((q) => (
                    <div key={q.id} className="px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                      <p className="text-xs text-gray-300 truncate">{q.question}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowMarkResolvedModal(false); setMarkResolvedAnswer(""); }}
                    className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleBulkMarkResolved}
                    disabled={bulkLoading}
                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {bulkLoading ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    Tandai Terjawab
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-400">
              {activeTab === "pending" ? "Tidak ada pertanyaan yang belum terjawab" : "Belum ada pertanyaan yang sudah terjawab"}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              {activeTab === "pending"
                ? "Semua pertanyaan berhasil dijawab oleh AI atau sudah ditambahkan ke knowledge base"
                : "Tambahkan jawaban pada tab 'Belum Terjawab' untuk memindahkannya ke sini"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select All (only in pending tab) */}
            {activeTab === "pending" && filtered.length > 0 && (
              <div className="flex items-center gap-3 px-5 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs text-gray-400">Pilih Semua</span>
              </div>
            )}
            {filtered.map((q) => (
              <div
                key={q.id}
                className={`glass rounded-xl border overflow-hidden transition-all ${
                  selectedIds.has(q.id) ? "border-indigo-500/40 bg-indigo-500/5" :
                  q.resolved_at ? "border-green-500/20" : "border-white/10"
                }`}
              >
                <div className="w-full text-left px-5 py-4 flex items-start gap-4">
                  {/* Checkbox (only in pending tab) */}
                  {activeTab === "pending" && (
                    <div className="flex-shrink-0 pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(q.id)}
                        onChange={() => toggleSelect(q.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Status icon */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      q.resolved_at ? "bg-green-500/20" : "bg-orange-500/20"
                    }`}>
                      {q.resolved_at ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedQuestion(q)}>
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className="text-xs text-gray-500">
                        {new Date(q.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-400">{q.users?.name || q.users?.email || "-"}</span>
                      {isAdmin && q.ai_bots && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium">{q.ai_bots.name}</span>
                        </>
                      )}
                      {q.priority && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${PRIORITY_CONFIG[q.priority]?.bg} ${PRIORITY_CONFIG[q.priority]?.color}`}>
                            {PRIORITY_CONFIG[q.priority]?.label}
                          </span>
                        </>
                      )}
                      {q.resolved_at && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="px-2 py-0.5 rounded-lg bg-green-500/20 text-green-300 text-xs font-medium">Sudah Terjawab</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white truncate">{q.question}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate italic">{q.bot_response}</p>
                  </div>

                  {/* Priority setter + action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {activeTab === "pending" && (
                      <select
                        value={q.priority || ""}
                        onChange={(e) => setPriority(q.id, e.target.value || null)}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="" className="bg-gray-900">Set Priority</option>
                        <option value="high" className="bg-gray-900">High</option>
                        <option value="medium" className="bg-gray-900">Medium</option>
                        <option value="low" className="bg-gray-900">Low</option>
                      </select>
                    )}
                    <button
                      onClick={() => setSelectedQuestion(q)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      Lihat
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
