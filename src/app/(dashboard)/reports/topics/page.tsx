"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import type { Topic, TopicQuestion } from "@/types";

interface AiBot {
  id: string;
  name: string;
}

export default function TopicsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBotId, setFilterBotId] = useState<string>("");
  const [bots, setBots] = useState<AiBot[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [topicQuestions, setTopicQuestions] = useState<TopicQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSampleQuestion, setEditSampleQuestion] = useState("");

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterBotId) params.set("botId", filterBotId);
    const res = await fetch(`/api/topics?${params.toString()}`);
    if (res.ok) {
      setTopics(await res.json());
    }
    setLoading(false);
  }, [filterBotId]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/admin/bots")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setBots(data); })
        .catch(() => {});
    }
  }, [isAdmin]);

  const fetchTopicQuestions = async (topic: Topic) => {
    setSelectedTopic(topic);
    setQuestionsLoading(true);
    const res = await fetch(`/api/topics?topicId=${topic.id}&includeQuestions=true`);
    if (res.ok) {
      setTopicQuestions(await res.json());
    }
    setQuestionsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus topik ini? Semua data pertanyaan terkait juga akan dihapus.")) return;
    await fetch(`/api/topics?id=${id}`, { method: "DELETE" });
    fetchTopics();
    if (selectedTopic?.id === id) setSelectedTopic(null);
  };

  const handleEdit = (topic: Topic) => {
    setEditingTopic(topic);
    setEditName(topic.name);
    setEditDescription(topic.description || "");
    setEditSampleQuestion(topic.sample_question || "");
  };

  const handleSaveEdit = async () => {
    if (!editingTopic || !editName.trim()) return;
    await fetch("/api/topics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingTopic.id,
        name: editName.trim(),
        description: editDescription.trim() || null,
        sample_question: editSampleQuestion.trim() || null,
      }),
    });
    setEditingTopic(null);
    fetchTopics();
  };

  const maxCount = topics.length > 0 ? Math.max(...topics.map((t) => t.question_count), 1) : 1;

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Detail Modal */}
      <AnimatePresence>
        {selectedTopic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            >
              <div className="flex items-start justify-between p-5 border-b border-white/10 flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-white text-sm">{selectedTopic.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedTopic.description || "Tidak ada deskripsi"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-indigo-400">{selectedTopic.question_count} pertanyaan</span>
                    {selectedTopic.ai_bots?.name && (
                      <>
                        <span className="text-xs text-gray-600">&bull;</span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{selectedTopic.ai_bots.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedTopic(null)} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {selectedTopic.sample_question && (
                <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex-shrink-0">
                  <p className="text-xs font-semibold text-indigo-400 mb-1">Contoh Pertanyaan (Quick Question)</p>
                  <p className="text-sm text-gray-300">{selectedTopic.sample_question}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-0">
                <p className="text-xs font-semibold text-gray-500 mb-2">Pertanyaan User yang Masuk Topik Ini</p>
                {questionsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : topicQuestions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">Belum ada pertanyaan tercatat</div>
                ) : (
                  topicQuestions.map((q) => (
                    <div key={q.id} className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                      <p className="text-sm text-gray-300">{q.question}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-500">
                          {new Date(q.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                        {q.users && (
                          <>
                            <span className="text-xs text-gray-600">&bull;</span>
                            <span className="text-xs text-gray-400">{q.users.name || q.users.email}</span>
                          </>
                        )}
                        <span className="text-xs text-gray-600">&bull;</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          q.similarity >= 0.7 ? "bg-green-500/20 text-green-400" :
                          q.similarity >= 0.5 ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-gray-500/20 text-gray-400"
                        }`}>
                          {(q.similarity * 100).toFixed(0)}% match
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-5 py-4 border-t border-white/10 flex-shrink-0 flex justify-end">
                <button onClick={() => setSelectedTopic(null)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all">
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingTopic && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass border border-white/10 rounded-2xl w-full max-w-lg p-6"
            >
              <h3 className="text-white font-semibold text-sm mb-4">Edit Topik</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nama Topik</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Deskripsi</label>
                  <input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contoh Pertanyaan (Quick Question)</label>
                  <input
                    value={editSampleQuestion}
                    onChange={(e) => setEditSampleQuestion(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setEditingTopic(null)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all">
                  Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-50"
                >
                  Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Topik Populer</h1>
            <p className="text-gray-400 text-sm mt-1">Analisis topik pertanyaan yang sering ditanyakan pengguna</p>
          </div>
          <button
            onClick={fetchTopics}
            className="px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Bot filter (admin) */}
        {isAdmin && bots.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500">Filter Bot:</span>
            <select
              value={filterBotId}
              onChange={(e) => setFilterBotId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="" className="bg-gray-900">Semua Bot</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-4 border border-white/10">
            <p className="text-2xl font-bold text-white">{topics.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total Topik</p>
          </div>
          <div className="glass rounded-xl p-4 border border-indigo-500/20">
            <p className="text-2xl font-bold text-indigo-400">{topics.reduce((sum, t) => sum + t.question_count, 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Total Pertanyaan Ter-klasifikasi</p>
          </div>
          <div className="glass rounded-xl p-4 border border-white/10">
            <p className="text-2xl font-bold text-white">{topics.filter((t) => t.question_count > 0).length}</p>
            <p className="text-xs text-gray-400 mt-1">Topik Aktif (Punya Pertanyaan)</p>
          </div>
        </div>

        {/* Topic List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
            </div>
            <p className="text-gray-400">Belum ada topik</p>
            <p className="text-gray-600 text-sm mt-1">Topik akan otomatis muncul setelah dokumen di-upload atau pengguna mulai bertanya</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic, index) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="glass rounded-xl border border-white/10 p-5 hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    index === 0 ? "bg-yellow-500/20" : index === 1 ? "bg-gray-300/20" : index === 2 ? "bg-orange-500/20" : "bg-white/5"
                  }`}>
                    <span className={`text-xs font-bold ${
                      index === 0 ? "text-yellow-400" : index === 1 ? "text-gray-300" : index === 2 ? "text-orange-400" : "text-gray-500"
                    }`}>
                      {index + 1}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => fetchTopicQuestions(topic)}>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">{topic.name}</h3>
                      {topic.ai_bots?.name && isAdmin && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs flex-shrink-0">{topic.ai_bots.name}</span>
                      )}
                    </div>
                    {topic.description && (
                      <p className="text-xs text-gray-400 mb-2 truncate">{topic.description}</p>
                    )}
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${(topic.question_count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-indigo-400 whitespace-nowrap">
                        {topic.question_count} pertanyaan
                      </span>
                    </div>
                    {topic.sample_question && (
                      <p className="text-xs text-gray-500 mt-2 italic truncate">&ldquo;{topic.sample_question}&rdquo;</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(topic); }}
                      className="p-2 rounded-lg hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-400 transition-all"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(topic.id); }}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all"
                      title="Hapus"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
