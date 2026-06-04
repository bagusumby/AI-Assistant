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
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { href: "/admin/users", label: "Kelola Users", desc: "CRUD pengguna sistem", color: "indigo", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
            { href: "/admin/roles", label: "Kelola Roles", desc: "Manajemen role akses", color: "orange", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /> },
            { href: "/admin/bots", label: "Kelola AI Bots", desc: "Konfigurasi bot & prompt", color: "purple", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /> },
            { href: "/admin/menus", label: "Kelola Menus", desc: "Navigasi & permissions", color: "cyan", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /> },
            { href: "/upload", label: "Upload Dokumen", desc: "Tambah knowledge base", color: "green", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /> },
          ].map((item) => (
            <a key={item.href} href={item.href}
              className={`glass rounded-xl p-6 border border-white/10 hover:border-${item.color}-500/30 transition-all group`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-${item.color}-500/20 flex items-center justify-center group-hover:bg-${item.color}-500/30 transition-all`}>
                  <svg className={`w-6 h-6 text-${item.color}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {item.icon}
                  </svg>
                </div>
                <div>
                  <h3 className={`font-semibold text-white group-hover:text-${item.color}-300 transition-colors`}>{item.label}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
