"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QuickQuestion {
  id: string;
  topic: string;
  question: string;
  count: number;
}

interface QuickQuestionsProps {
  botId: string;
  visible: boolean;
  onSelect: (question: string) => void;
}

export function QuickQuestionsToggle({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-3 rounded-xl flex items-center justify-center transition-all ${
        active
          ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
          : "bg-white/5 text-gray-500 border border-white/10 hover:text-indigo-400 hover:border-indigo-500/30"
      }`}
      title={active ? "Sembunyikan saran pertanyaan" : "Tampilkan saran pertanyaan"}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    </button>
  );
}

export default function QuickQuestions({ botId, visible, onSelect }: QuickQuestionsProps) {
  const [questions, setQuestions] = useState<QuickQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!botId) {
      setQuestions([]);
      return;
    }

    setLoading(true);
    fetch(`/api/topics/clusters/quick-questions?botId=${botId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setQuestions(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [botId]);

  if (loading || questions.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-wrap gap-2 pb-3 max-w-3xl mx-auto"
        >
          {questions.map((q, i) => (
            <motion.button
              key={q.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(q.question)}
              className="px-3 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all cursor-pointer max-w-[280px] truncate"
              title={q.question}
            >
              {q.question}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
