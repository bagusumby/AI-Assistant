"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import type { QuestionCluster, ClusterItem } from "@/types";

interface AiBot {
  id: string;
  name: string;
}

export default function ClustersPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [clusters, setClusters] = useState<QuestionCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filterBotId, setFilterBotId] = useState<string>("");
  const [bots, setBots] = useState<AiBot[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<QuestionCluster | null>(null);
  const [clusterItems, setClusterItems] = useState<ClusterItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{ clusters: number; totalClassified: number } | null>(null);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterBotId) params.set("botId", filterBotId);
    const res = await fetch(`/api/topics/clusters?${params.toString()}`);
    if (res.ok) {
      setClusters(await res.json());
    }
    setLoading(false);
  }, [filterBotId]);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/admin/bots")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setBots(data); })
        .catch(() => {});
    }
  }, [isAdmin]);

  const runAnalysis = async () => {
    const botId = isAdmin ? filterBotId : (session?.user as { botId?: string })?.botId;
    if (!botId) {
      alert("Pilih AI Bot terlebih dahulu");
      return;
    }
    setAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await fetch("/api/topics/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnalyzeResult({ clusters: data.clusters, totalClassified: data.totalClassified });
        fetchClusters();
      } else {
        alert(data.error || "Gagal menganalisis");
      }
    } catch {
      alert("Terjadi kesalahan jaringan");
    }
    setAnalyzing(false);
  };

  const fetchClusterItems = async (cluster: QuestionCluster) => {
    setSelectedCluster(cluster);
    setItemsLoading(true);
    const res = await fetch(`/api/topics/clusters?clusterId=${cluster.id}`);
    if (res.ok) {
      setClusterItems(await res.json());
    }
    setItemsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus klaster ini?")) return;
    await fetch(`/api/topics/clusters?id=${id}`, { method: "DELETE" });
    fetchClusters();
    if (selectedCluster?.id === id) setSelectedCluster(null);
  };

  const maxCount = clusters.length > 0 ? Math.max(...clusters.map((c) => c.question_count), 1) : 1;

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Detail Modal */}
      <AnimatePresence>
        {selectedCluster && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            >
              <div className="flex items-start justify-between p-5 border-b border-white/10 flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-white text-sm">{selectedCluster.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedCluster.description || "Tidak ada deskripsi"}</p>
                  <span className="text-xs text-indigo-400 mt-1 inline-block">{selectedCluster.question_count} pertanyaan</span>
                </div>
                <button onClick={() => setSelectedCluster(null)} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-0">
                <p className="text-xs font-semibold text-gray-500 mb-2">Pertanyaan dalam Klaster Ini</p>
                {itemsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : clusterItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">Tidak ada data</div>
                ) : (
                  clusterItems.map((item) => (
                    <div key={item.id} className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                      <p className="text-sm text-gray-300">{item.question}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-500">
                          {item.message_created_at ? new Date(item.message_created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                        </span>
                        {item.users && (
                          <>
                            <span className="text-xs text-gray-600">&bull;</span>
                            <span className="text-xs text-gray-400">{item.users.name || item.users.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-5 py-4 border-t border-white/10 flex-shrink-0 flex justify-end">
                <button onClick={() => setSelectedCluster(null)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all">
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Klaster Pertanyaan</h1>
            <p className="text-gray-400 text-sm mt-1">Klasifikasi topik otomatis dari pertanyaan pengguna saat chat</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchClusters}
              className="px-3 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
            <button
              onClick={runAnalysis}
              disabled={analyzing || (isAdmin && !filterBotId)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Menganalisis...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Analisis Sekarang
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bot filter (admin) */}
        {isAdmin && bots.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-gray-500">Pilih Bot:</span>
            <select
              value={filterBotId}
              onChange={(e) => setFilterBotId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="" className="bg-gray-900">-- Pilih AI Bot --</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
              ))}
            </select>
            {isAdmin && !filterBotId && (
              <span className="text-xs text-orange-400">* Pilih bot untuk menjalankan analisis</span>
            )}
          </div>
        )}

        {/* Analysis result notification */}
        <AnimatePresence>
          {analyzeResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-sm text-green-400 flex items-center gap-2"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Analisis selesai: {analyzeResult.clusters} klaster dibuat dari {analyzeResult.totalClassified} pertanyaan
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {clusters.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="glass rounded-xl p-4 border border-white/10">
              <p className="text-2xl font-bold text-white">{clusters.length}</p>
              <p className="text-xs text-gray-400 mt-1">Total Klaster</p>
            </div>
            <div className="glass rounded-xl p-4 border border-indigo-500/20">
              <p className="text-2xl font-bold text-indigo-400">{clusters.reduce((sum, c) => sum + c.question_count, 0)}</p>
              <p className="text-xs text-gray-400 mt-1">Total Pertanyaan</p>
            </div>
            <div className="glass rounded-xl p-4 border border-white/10">
              <p className="text-2xl font-bold text-white">
                {clusters.length > 0 ? new Date(clusters[0].analyzed_at || clusters[0].created_at).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "-"}
              </p>
              <p className="text-xs text-gray-400 mt-1">Terakhir Dianalisis</p>
            </div>
          </div>
        )}

        {/* Cluster List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : clusters.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <p className="text-gray-400">Belum ada klaster</p>
            <p className="text-gray-600 text-sm mt-1">Klik &ldquo;Analisis Sekarang&rdquo; untuk mengelompokkan pertanyaan pengguna ke dalam klaster topik</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clusters.map((cluster, index) => (
              <motion.div
                key={cluster.id}
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
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => fetchClusterItems(cluster)}>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">{cluster.name}</h3>
                      {cluster.ai_bots?.name && isAdmin && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs flex-shrink-0">{cluster.ai_bots.name}</span>
                      )}
                    </div>
                    {cluster.description && (
                      <p className="text-xs text-gray-400 mb-2 truncate">{cluster.description}</p>
                    )}
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${(cluster.question_count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-indigo-400 whitespace-nowrap">
                        {cluster.question_count} pertanyaan
                      </span>
                    </div>
                    {/* Representative question (Quick Question) */}
                    {cluster.representative_question && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <p className="text-xs font-semibold text-indigo-400 mb-0.5">Quick Question</p>
                        <p className="text-xs text-gray-300">&ldquo;{cluster.representative_question}&rdquo;</p>
                      </div>
                    )}
                    {/* Sample questions */}
                    {cluster.sample_questions && cluster.sample_questions.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {(typeof cluster.sample_questions === "string" ? JSON.parse(cluster.sample_questions) : cluster.sample_questions).slice(0, 2).map((q: string, i: number) => (
                          <p key={i} className="text-xs text-gray-500 italic truncate">&ldquo;{q}&rdquo;</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(cluster.id); }}
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
