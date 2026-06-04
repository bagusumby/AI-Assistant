"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationWarning } from "@/lib/useNavigationWarning";

interface Message {
  role: "user" | "assistant";
  content: string;
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
                    <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-md"
                        : "glass text-gray-200 rounded-bl-md"
                    }`}>
                      {msg.content || (loading && i === messages.length - 1 ? <TypingIndicator /> : "")}
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
