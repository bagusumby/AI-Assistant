"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import type { FeedbackReport, FeedbackType } from "@/types";
import AddKnowledgeModal from "@/components/ui/AddKnowledgeModal";

const FEEDBACK_LABELS: Record<FeedbackType, string> = {
  incomplete: "Tidak Lengkap",
  incorrect: "Tidak Akurat",
  unclear: "Kurang Jelas",
  not_relevant: "Tidak Relevan",
  outdated: "Tidak Terkini",
  other: "Lainnya",
};

const FEEDBACK_COLORS: Record<FeedbackType, string> = {
  incomplete: "bg-yellow-500/20 text-yellow-300",
  incorrect: "bg-red-500/20 text-red-300",
  unclear: "bg-orange-500/20 text-orange-300",
  not_relevant: "bg-purple-500/20 text-purple-300",
  outdated: "bg-blue-500/20 text-blue-300",
  other: "bg-gray-500/20 text-gray-300",
};

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface DetailModalProps {
  report: FeedbackReport;
  onClose: () => void;
  onRefresh?: () => void;
}

function DetailModal({ report, onClose, onRefresh }: DetailModalProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/reports/session/${report.session_id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [report.session_id]);

  const isResolved = !!report.resolved_at;

  // Get the user question that was before the feedback-ed message
  const getUserQuestion = () => {
    if (report.message_id && messages.length > 0) {
      const idx = messages.findIndex((m) => m.id === report.message_id);
      if (idx > 0) return messages[idx - 1].content;
    }
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    return lastUserMsg?.content || report.message || "Pertanyaan tidak tersedia";
  };

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
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isResolved ? "bg-green-500/20" : "bg-indigo-500/20"}`}>
              {isResolved ? (
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">
                {isResolved ? "Feedback Sudah Diperbaiki" : "Detail Feedback"}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-gray-400">{report.users?.name || report.users?.email || "-"}</span>
                {report.ai_bots?.name && (
                  <>
                    <span className="text-gray-600 text-xs">•</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{report.ai_bots.name}</span>
                  </>
                )}
                <span className="text-gray-600 text-xs">•</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${FEEDBACK_COLORS[report.feedback_type]}`}>
                  {FEEDBACK_LABELS[report.feedback_type]}
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
          {/* Feedback message from user */}
          {report.message && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs font-semibold text-red-400 mb-1">Pesan Feedback dari User</p>
              <p className="text-sm text-gray-300">{report.message}</p>
            </div>
          )}

          {/* Resolved answer section */}
          {isResolved && report.resolved_answer && (
            <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-green-400">Jawaban yang Sudah Diperbaiki</p>
                {report.resolved_filename && (
                  <span className="text-xs text-gray-500">{report.resolved_filename}</span>
                )}
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{report.resolved_answer}</p>
            </div>
          )}

          {/* Chat messages */}
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
                    report.message_id && msg.id === report.message_id
                      ? "ring-2 ring-red-500/50"
                      : ""
                  }`}
                >
                  {msg.content}
                  {report.message_id && msg.id === report.message_id && (
                    <div className="mt-2 pt-2 border-t border-red-500/30 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.463-.943a6.8 6.8 0 001.04-3.682c0-1.17-.28-2.268-.771-3.243-.144-.282-.249-.566-.249-.857V5.11a.75.75 0 01.75-.75H9a.75.75 0 00-.75.75v.75m0 0v.75m0-.75H5.625c-.621 0-1.125.504-1.125 1.125v15c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H9.75" />
                      </svg>
                      <span className="text-xs text-red-400">Jawaban ini mendapat feedback</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {isResolved
              ? `Diperbaiki pada ${new Date(report.resolved_at!).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}`
              : `Feedback dikirim pada ${new Date(report.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}`
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Perbaiki Jawaban
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Add/Edit Knowledge Modal */}
      <AnimatePresence>
        {showAddKnowledge && (
          <AddKnowledgeModal
            question={getUserQuestion()}
            botId={report.ai_bot_id}
            botName={report.ai_bots?.name}
            sourceType="feedback"
            sourceId={report.id}
            initialAnswer={isEditing ? (report.resolved_answer || "") : ""}
            replaceFilename={isEditing ? (report.resolved_filename || undefined) : undefined}
            onClose={() => setShowAddKnowledge(false)}
            onSuccess={() => onRefresh?.()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FeedbackReportPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<FeedbackReport | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [sortBy, setSortBy] = useState<"priority" | "date">("priority");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showMarkResolvedModal, setShowMarkResolvedModal] = useState(false);
  const [markResolvedAnswer, setMarkResolvedAnswer] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("status", activeTab);
    params.set("sort", sortBy);
    if (filterPriority !== "all") params.set("priority", filterPriority);
    const res = await fetch(`/api/reports/feedback?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setReports(data);
    }
    setLoading(false);
  }, [activeTab, sortBy, filterPriority]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filtered = filterType === "all" ? reports : reports.filter((r) => r.feedback_type === filterType);

  const setPriority = async (id: string, priority: string | null) => {
    await fetch("/api/reports/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, priority }),
    });
    fetchReports();
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
      setSelectedIds(new Set(filtered.map((r) => r.id)));
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
          sourceType: "feedback",
          resolvedAnswer: markResolvedAnswer.trim() || null,
        }),
      });
      setSelectedIds(new Set());
      setShowMarkResolvedModal(false);
      setMarkResolvedAnswer("");
      fetchReports();
    } catch {
      // silently fail
    }
    setBulkLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <AnimatePresence>
        {selectedReport && (
          <DetailModal key="detail-modal" report={selectedReport} onClose={() => setSelectedReport(null)} onRefresh={fetchReports} />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Laporan Feedback</h1>
            <p className="text-gray-400 text-sm mt-1">
              {isAdmin ? "Semua feedback dari pengguna terhadap jawaban AI" : "Feedback pengguna untuk AI Bot Anda"}
            </p>
          </div>
          <button
            onClick={fetchReports}
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
            Belum Ditangani
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "resolved"
                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Sudah Diperbaiki
          </button>
        </div>

        {/* Controls: Sort + Priority Filter + Feedback Type Filter */}
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
        </div>

        {/* Feedback type filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === "all" ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/30" : "border border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            Semua Tipe ({reports.length})
          </button>
          {(Object.entries(FEEDBACK_LABELS) as [FeedbackType, string][]).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterType === type ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/30" : "border border-white/10 text-gray-400 hover:border-white/20"
              }`}
            >
              {label} ({reports.filter((r) => r.feedback_type === type).length})
            </button>
          ))}
        </div>

        {/* Bulk action bar + Result count */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-500">
            Menampilkan {filtered.length} feedback
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
                Tandai Diperbaiki
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
                <h3 className="text-white font-semibold text-sm mb-1">Tandai {selectedIds.size} Feedback Sebagai Diperbaiki</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Feedback yang dipilih akan ditandai sebagai sudah diperbaiki. Opsional: tuliskan jawaban atau referensi kenapa feedback ini sudah ter-cover.
                </p>

                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1.5">Jawaban / Keterangan (opsional)</label>
                  <textarea
                    value={markResolvedAnswer}
                    onChange={(e) => setMarkResolvedAnswer(e.target.value)}
                    placeholder="Contoh: Sudah diperbaiki dengan update FAQ tentang..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none text-sm text-white placeholder:text-gray-600 resize-none"
                  />
                </div>

                <div className="mb-4 max-h-40 overflow-y-auto space-y-1.5">
                  <p className="text-xs text-gray-500 font-medium mb-1">Feedback yang akan ditandai:</p>
                  {filtered.filter((r) => selectedIds.has(r.id)).map((r) => (
                    <div key={r.id} className="px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                      <p className="text-xs text-gray-300 truncate">{r.message || `Feedback: ${FEEDBACK_LABELS[r.feedback_type]}`}</p>
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
                    Tandai Diperbaiki
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-gray-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-400">
              {activeTab === "pending" ? "Tidak ada feedback yang belum ditangani" : "Belum ada feedback yang sudah diperbaiki"}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              {activeTab === "pending"
                ? "Semua feedback sudah ditangani atau belum ada feedback masuk"
                : "Perbaiki jawaban pada tab 'Belum Ditangani' untuk memindahkannya ke sini"}
            </p>
          </div>
        ) : (
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {activeTab === "pending" && (
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tanggal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                    {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Bot</th>}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipe</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Pesan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((report) => (
                    <tr
                      key={report.id}
                      onClick={() => setSelectedReport(report)}
                      className={`hover:bg-white/5 transition-colors cursor-pointer group ${selectedIds.has(report.id) ? "bg-indigo-500/5" : ""}`}
                    >
                      {activeTab === "pending" && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(report.id)}
                            onChange={() => toggleSelect(report.id)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                        {new Date(report.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-300 text-xs">{report.users?.name || "-"}</div>
                        <div className="text-gray-500 text-xs">{report.users?.email || "-"}</div>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium">
                            {report.ai_bots?.name || "-"}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${FEEDBACK_COLORS[report.feedback_type]}`}>
                          {FEEDBACK_LABELS[report.feedback_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {activeTab === "pending" ? (
                          <select
                            value={report.priority || ""}
                            onChange={(e) => { e.stopPropagation(); setPriority(report.id, e.target.value || null); }}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="" className="bg-gray-900">-</option>
                            <option value="high" className="bg-gray-900">High</option>
                            <option value="medium" className="bg-gray-900">Medium</option>
                            <option value="low" className="bg-gray-900">Low</option>
                          </select>
                        ) : report.priority ? (
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${PRIORITY_CONFIG[report.priority]?.bg} ${PRIORITY_CONFIG[report.priority]?.color}`}>
                            {PRIORITY_CONFIG[report.priority]?.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs max-w-xs">
                        {report.message ? <p className="line-clamp-2">{report.message}</p> : <span className="text-gray-600 italic">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 whitespace-nowrap">
                          Lihat Chat
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

