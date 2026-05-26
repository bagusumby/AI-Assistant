"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Stats {
  totalUsers: number;
  totalFiles: number;
  totalChunks: number;
  totalSessions: number;
  totalMessages: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statCards = stats
    ? [
        { label: "Total Users", value: stats.totalUsers, color: "from-blue-500 to-cyan-500" },
        { label: "Total Files", value: stats.totalFiles, color: "from-purple-500 to-pink-500" },
        { label: "Total Chunks", value: stats.totalChunks, color: "from-orange-500 to-red-500" },
        { label: "Chat Sessions", value: stats.totalSessions, color: "from-green-500 to-emerald-500" },
        { label: "Total Messages", value: stats.totalMessages, color: "from-indigo-500 to-violet-500" },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-2xl font-bold mb-2 gradient-text">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm mb-8">Kelola sistem RAG AI Assistant</p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-24 mb-3" />
                <div className="h-8 bg-white/10 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass rounded-xl p-6 border border-white/10"
              >
                <p className="text-sm text-gray-400 mb-1">{card.label}</p>
                <p className={`text-3xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
                  {card.value.toLocaleString()}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/admin/users"
            className="glass rounded-xl p-6 border border-white/10 hover:border-indigo-500/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/30 transition-all">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">Kelola Users</h3>
                <p className="text-sm text-gray-400">CRUD pengguna sistem</p>
              </div>
            </div>
          </a>

          <a
            href="/upload"
            className="glass rounded-xl p-6 border border-white/10 hover:border-purple-500/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-all">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">Upload Dokumen</h3>
                <p className="text-sm text-gray-400">Tambah knowledge base</p>
              </div>
            </div>
          </a>
        </div>
      </motion.div>
    </div>
  );
}
