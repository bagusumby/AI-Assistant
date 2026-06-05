"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import type { UnansweredQuestion } from "@/types";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface DetailModalProps {
  question: UnansweredQuestion;
  onClose: () => void;
}

function DetailModal({ question, onClose }: DetailModalProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reports/session/${question.session_id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [question.session_id]);

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
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Detail Percakapan</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-gray-400">{question.users?.name || question.users?.email || "-"}</span>
                {question.ai_bots?.name && (
                  <>
                    <span className="text-gray-600 text-xs">•</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{question.ai_bots.name}</span>
                  </>
                )}
                <span className="text-gray-600 text-xs">•</span>
                <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-xs">Tidak Terjawab</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 ml-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Unanswered question highlight */}
        <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
          <p className="text-xs font-semibold text-orange-400 mb-1">Pertanyaan yang tidak dapat dijawab</p>
          <p className="text-sm text-gray-300">{question.question}</p>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                  <div className="h-12 w-48 rounded-2xl bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
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
                    // Highlight the unanswered bot reply
                    msg.role === "assistant" && msg.content === question.bot_response
                      ? "ring-2 ring-orange-500/50"
                      : ""
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && msg.content === question.bot_response && (
                    <div className="mt-2 pt-2 border-t border-orange-500/30 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                      </svg>
                      <span className="text-xs text-orange-400">Jawaban tidak ditemukan dalam dokumen</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex-shrink-0">
          <p className="text-xs text-gray-500">
            Tercatat pada {new Date(question.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
      </motion.div>
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

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/reports/unanswered");
    if (res.ok) {
      const data = await res.json();
      setQuestions(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const uniqueBots = Array.from(
    new Map(questions.filter((q) => q.ai_bots).map((q) => [q.ai_bots!.id, q.ai_bots!])).values()
  );

  const filtered = filterBot === "all" ? questions : questions.filter((q) => q.ai_bots?.id === filterBot);

  return (
    <div className="h-full overflow-y-auto p-6">
      <AnimatePresence>
        {selectedQuestion && (
          <DetailModal key="detail-modal" question={selectedQuestion} onClose={() => setSelectedQuestion(null)} />
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

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-white/10">
            <p className="text-2xl font-bold text-white">{questions.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total Pertanyaan Tak Terjawab</p>
          </div>
          {isAdmin && (
            <div className="glass rounded-xl p-4 border border-white/10">
              <p className="text-2xl font-bold text-white">{uniqueBots.length}</p>
              <p className="text-xs text-gray-400 mt-1">AI Bot Terlibat</p>
            </div>
          )}
          <div className="glass rounded-xl p-4 border border-white/10">
            <p className="text-2xl font-bold text-white">
              {questions.filter((q) => {
                const d = new Date(q.created_at);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Bulan Ini</p>
          </div>
        </div>

        {/* Bot filter (admin only) */}
        {isAdmin && uniqueBots.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilterBot("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterBot === "all" ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/30" : "border border-white/10 text-gray-400 hover:border-white/20"
              }`}
            >
              Semua Bot ({questions.length})
            </button>
            {uniqueBots.map((bot) => (
              <button
                key={bot.id}
                onClick={() => setFilterBot(bot.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterBot === bot.id ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/30" : "border border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                {bot.name} ({questions.filter((q) => q.ai_bots?.id === bot.id).length})
              </button>
            ))}
          </div>
        )}

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
            <p className="text-gray-400">Tidak ada pertanyaan tak terjawab</p>
            <p className="text-gray-600 text-sm mt-1">Semua pertanyaan berhasil dijawab oleh AI dari dokumen yang tersedia</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => (
              <div
                key={q.id}
                onClick={() => setSelectedQuestion(q)}
                className="glass rounded-xl border border-white/10 overflow-hidden cursor-pointer hover:border-indigo-500/30 hover:bg-white/3 transition-all group"
              >
                <div className="w-full text-left px-5 py-4 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
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
                    </div>
                    <p className="text-sm font-medium text-white truncate">{q.question}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate italic">{q.bot_response}</p>
                  </div>
                  <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 whitespace-nowrap flex-shrink-0 mt-1">
                    Lihat Chat
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
