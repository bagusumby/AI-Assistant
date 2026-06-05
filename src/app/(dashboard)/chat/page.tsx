"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationWarning } from "@/lib/useNavigationWarning";

interface Message {
  role: "user" | "assistant";
  content: string;
  id?: string;
}

interface AiBot {
  id: string;
  name: string;
  slug: string;
  description?: string;
  chat_enabled: boolean;
}

const LOADING_TEXTS = [
  "Mencari dokumen terkait...",
  "Menganalisis konteks...",
  "Menyusun jawaban...",
];

function TypingIndicator() {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % LOADING_TEXTS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="flex flex-col gap-2">
      <span className="flex gap-1">
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.1s]" />
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
      </span>
      <span className="text-gray-400 text-xs animate-pulse">{LOADING_TEXTS[textIndex]}</span>
    </span>
  );
}

const FEEDBACK_TYPES: { value: string; label: string }[] = [
  { value: "incomplete", label: "Jawaban tidak lengkap" },
  { value: "incorrect", label: "Jawaban tidak akurat / salah" },
  { value: "unclear", label: "Jawaban kurang jelas" },
  { value: "not_relevant", label: "Tidak relevan dengan pertanyaan" },
  { value: "outdated", label: "Informasi sudah tidak terkini" },
  { value: "other", label: "Lainnya" },
];

interface FeedbackModalProps {
  messageId: string | undefined;
  sessionId: string | null;
  botId: string;
  onClose: () => void;
}

function FeedbackModal({ messageId, sessionId, botId, onClose }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackType) { setError("Pilih tipe feedback terlebih dahulu"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId || null,
          session_id: sessionId,
          bot_id: botId,
          feedback_type: feedbackType,
          message: feedbackMsg.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal mengirim feedback");
      }
      setSubmitted(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4"
      >
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium">Terima kasih atas feedback Anda!</p>
            <p className="text-gray-400 text-sm text-center">Feedback Anda akan membantu kami meningkatkan kualitas jawaban.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.463-.943a6.8 6.8 0 001.04-3.682c0-1.17-.28-2.268-.771-3.243-.144-.282-.249-.566-.249-.857V5.11a.75.75 0 01.75-.75H9a.75.75 0 00-.75.75v.75m0 0v.75m0-.75H5.625c-.621 0-1.125.504-1.125 1.125v15c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H9.75" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Berikan Feedback</h3>
                  <p className="text-xs text-gray-400">Bantu kami meningkatkan jawaban AI</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2 font-medium">Apa masalah dengan jawaban ini? *</p>
                <div className="space-y-2">
                  {FEEDBACK_TYPES.map((ft) => (
                    <label
                      key={ft.value}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                        feedbackType === ft.value
                          ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                          : "border-white/10 hover:border-white/20 text-gray-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="feedback_type"
                        value={ft.value}
                        checked={feedbackType === ft.value}
                        onChange={() => setFeedbackType(ft.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        feedbackType === ft.value ? "border-indigo-500 bg-indigo-500" : "border-gray-600"
                      }`}>
                        {feedbackType === ft.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-sm">{ft.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Pesan tambahan (opsional)</label>
                <textarea
                  value={feedbackMsg}
                  onChange={(e) => setFeedbackMsg(e.target.value)}
                  placeholder="Jelaskan lebih detail tentang masalah ini..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none text-sm text-white placeholder-gray-600 transition-all"
                />
                <p className="text-right text-xs text-gray-600 mt-1">{feedbackMsg.length}/500</p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-all">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-all"
                >
                  {submitting ? "Mengirim..." : "Kirim Feedback"}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

function BotSelector({ onSelect, bots, loadingBots }: { onSelect: (bot: AiBot) => void; bots: AiBot[]; loadingBots: boolean }) {

  const botColors = [
    "from-indigo-500 to-purple-600",
    "from-cyan-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-red-600",
    "from-pink-500 to-rose-600",
    "from-violet-500 to-fuchsia-600",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 animate-float">
          <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold gradient-text mb-2">Pilih AI Assistant</h2>
        <p className="text-gray-400 text-sm max-w-md">Pilih AI Bot yang ingin kamu ajak bicara. Setiap bot memiliki knowledge base tersendiri.</p>
      </motion.div>

      {loadingBots ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 animate-pulse h-32" />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center text-gray-500">
          <p className="text-sm">Belum ada AI Bot yang aktif.</p>
          <p className="text-xs text-gray-600 mt-1">Hubungi admin untuk mengaktifkan bot.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
          {bots.map((bot, i) => (
            <motion.button
              key={bot.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(bot)}
              className="glass rounded-2xl p-6 text-left border border-white/10 hover:border-indigo-500/40 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${botColors[i % botColors.length]} flex items-center justify-center mb-4`}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors mb-1">{bot.name}</h3>
              {bot.description && (
                <p className="text-xs text-gray-400 line-clamp-2">{bot.description}</p>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [selectedBot, setSelectedBot] = useState<AiBot | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; title: string; ai_bot_id?: string }[]>([]);
  const [allBots, setAllBots] = useState<AiBot[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<{ messageId?: string; index: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useNavigationWarning(loading);

  const fetchSessions = useCallback(async () => {
    const res = await fetch("/api/history");
    if (res.ok) setSessions(await res.json());
  }, []);

  useEffect(() => {
    fetchSessions();
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAllBots(data); })
      .catch(() => {});
  }, [fetchSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (id: string, botId?: string) => {
    setSessionId(id);

    // Fetch messages and (if needed) bots list in parallel
    const botsSource = allBots.length > 0
      ? Promise.resolve(allBots)
      : fetch("/api/bots").then((r) => r.json()).then((d) => (Array.isArray(d) ? d : []) as AiBot[]).catch(() => [] as AiBot[]);

    const [msgRes, botsData] = await Promise.all([
      fetch(`/api/history/${id}`),
      botsSource,
    ]);

    if (msgRes.ok) {
      const msgs = await msgRes.json();
      setMessages(msgs.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })));
    }

    if (botsData.length > 0 && allBots.length === 0) setAllBots(botsData);

    if (botId) {
      const bot = botsData.find((b: AiBot) => b.id === botId);
      if (bot) {
        setSelectedBot(bot);
      } else {
        // Bot not found in list — fetch it directly so chat still opens
        const botRes = await fetch(`/api/bots`).then((r) => r.json()).catch(() => []);
        const freshBot = (Array.isArray(botRes) ? botRes : []).find((b: AiBot) => b.id === botId);
        setSelectedBot(freshBot ?? { id: botId, name: "AI Assistant", slug: "", chat_enabled: true });
      }
    } else {
      // No botId in session — use a placeholder so the chat UI still renders
      setSelectedBot({ id: "", name: "AI Assistant", slug: "", chat_enabled: true });
    }
  };

  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setSelectedBot(null);
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !selectedBot) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, sessionId, botId: selectedBot.id }),
      });

      if (!res.ok) throw new Error("Failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantMsg += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantMsg };
                  return updated;
                });
              }
              if (data.done && data.sessionId) {
                setSessionId(data.sessionId);
                fetchSessions();
                if (data.messageId) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...updated[updated.length - 1], id: data.messageId };
                    return updated;
                  });
                }
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Maaf, terjadi kesalahan." };
        return updated;
      });
    }

    setLoading(false);
  };

  return (
    <div className="flex h-full">
      <AnimatePresence>
        {feedbackTarget && selectedBot && (
          <FeedbackModal
            key="feedback-modal"
            messageId={feedbackTarget.messageId}
            sessionId={sessionId}
            botId={selectedBot.id}
            onClose={() => setFeedbackTarget(null)}
          />
        )}
      </AnimatePresence>
      {/* Chat Sessions Sidebar */}
      <div className="w-56 border-r border-white/10 flex flex-col bg-gray-950/50">
        <div className="p-3">
          <button onClick={newChat} className="w-full px-3 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-all">
            + Chat Baru
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id, s.ai_bot_id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-all ${
                sessionId === s.id ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {!selectedBot ? (
          <BotSelector onSelect={setSelectedBot} bots={allBots} loadingBots={allBots.length === 0} />
        ) : (
          <>
            {/* Bot Header */}
            <div className="px-6 py-3 border-b border-white/10 flex items-center gap-3 bg-gray-950/30">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{selectedBot.name}</p>
                {selectedBot.description && <p className="text-xs text-gray-400">{selectedBot.description}</p>}
              </div>
              <button
                onClick={() => { setSelectedBot(null); setMessages([]); setSessionId(null); }}
                className="ml-auto text-xs text-gray-500 hover:text-indigo-400 transition-colors px-2 py-1 rounded hover:bg-white/5"
              >
                Ganti Bot
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold gradient-text mb-1">{selectedBot.name}</h2>
                  <p className="text-gray-500 text-sm max-w-sm">Tanyakan apa saja tentang dokumen {selectedBot.name}. AI akan menjawab berdasarkan knowledge base yang tersedia.</p>
                </motion.div>
              )}

              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 max-w-[70%]">
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-md"
                          : "glass text-gray-200 rounded-bl-md"
                      }`}>
                        {msg.content || (loading && i === messages.length - 1 ? <TypingIndicator /> : "")}
                      </div>
                      {msg.role === "assistant" && msg.content && !(loading && i === messages.length - 1) && (
                        <div className="flex items-center gap-1 pl-1">
                          <button
                            onClick={() => handleCopy(msg.content, i)}
                            title="Salin jawaban"
                            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all"
                          >
                            {copiedIndex === i ? (
                              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => setFeedbackTarget({ messageId: msg.id, index: i })}
                            title="Berikan feedback negatif"
                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.463-.943a6.8 6.8 0 001.04-3.682c0-1.17-.28-2.268-.771-3.243-.144-.282-.249-.566-.249-.857V5.11a.75.75 0 01.75-.75H9a.75.75 0 00-.75.75v.75m0 0v.75m0-.75H5.625c-.621 0-1.125.504-1.125 1.125v15c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H9.75" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-3 max-w-3xl mx-auto">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Tanya ${selectedBot.name}...`}
                  rows={1}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none text-sm text-white placeholder-gray-500 transition-all"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </motion.button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
