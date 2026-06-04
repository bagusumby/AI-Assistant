"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationWarning } from "@/lib/useNavigationWarning";
import { useSession } from "next-auth/react";

interface FileItem {
  id: string;
  filename: string;
  file_size: number;
  total_chunks: number;
  status: string;
  created_at: string;
  ai_bot_id?: string;
}

interface AiBot {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export default function UploadPage() {
  const { data: session } = useSession();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [bots, setBots] = useState<AiBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [filterBotId, setFilterBotId] = useState<string>("");

  const isAdmin = session?.user?.role === "admin";
  const isManager = session?.user?.roleType === "manager";
  const managerBotName = (session?.user as { botSlug?: string })?.botSlug;

  useNavigationWarning(uploading);

  const fetchFiles = useCallback(async () => {
    const url = isAdmin && filterBotId ? `/api/files?botId=${filterBotId}` : "/api/files";
    const res = await fetch(url);
    if (res.ok) setFiles(await res.json());
  }, [isAdmin, filterBotId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/admin/bots")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setBots(data);
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setMessage({ type: "error", text: "Hanya file PDF yang diperbolehkan" });
      return;
    }

    if (isAdmin && !selectedBotId) {
      setMessage({ type: "error", text: "Pilih AI Bot tujuan upload terlebih dahulu" });
      return;
    }

    setUploading(true);
    setProgress(10);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    if (isAdmin && selectedBotId) {
      formData.append("botId", selectedBotId);
    }

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 90));
    }, 500);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      clearInterval(interval);
      setProgress(100);

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        fetchFiles();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      clearInterval(interval);
      setMessage({ type: "error", text: "Upload gagal" });
    }

    setTimeout(() => { setUploading(false); setProgress(0); }, 1000);
  };

  const deleteFile = async (id: string) => {
    if (!confirm("Hapus file ini?")) return;
    const res = await fetch(`/api/files?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchFiles();
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold gradient-text mb-1">Upload Dokumen</h1>
          <p className="text-gray-400 text-sm mb-6">Upload file PDF untuk knowledge base AI Bot</p>
        </motion.div>

        {/* Manager: bot badge */}
        {isManager && (
          <div className="flex items-center gap-2 mb-6 px-4 py-3 glass rounded-xl border border-indigo-500/30">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="text-sm text-gray-300">Upload ke:</span>
            <span className="text-sm font-semibold text-indigo-300">{managerBotName || "Bot Anda"}</span>
          </div>
        )}

        {/* Admin: bot selector + filter */}
        {isAdmin && (
          <div className="flex gap-3 mb-6">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1.5">Bot tujuan upload</label>
              <select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none text-sm text-white"
              >
                <option value="" className="bg-gray-900">-- Pilih AI Bot --</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1.5">Filter tampilan file</label>
              <select
                value={filterBotId}
                onChange={(e) => setFilterBotId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none text-sm text-white"
              >
                <option value="" className="bg-gray-900">Semua Bot</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Alert */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-xl mb-6 text-sm ${
                message.type === "success" ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]); }}
          onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".pdf"; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) uploadFile(f); }; input.click(); }}
          className={`glass rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
            dragOver ? "border-indigo-500 bg-indigo-500/10 scale-[1.02]" : "hover:border-white/20 hover:bg-white/5"
          }`}
        >
          <motion.div animate={{ y: dragOver ? -5 : 0 }} className="inline-block mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
          </motion.div>
          <h3 className="text-white font-medium mb-1">Drag & drop PDF di sini</h3>
          <p className="text-gray-500 text-sm">atau klik untuk memilih file</p>
        </motion.div>

        {/* Progress */}
        <AnimatePresence>
          {uploading && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 glass rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Memproses...</span>
                <span className="text-indigo-400">{progress}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File List */}
        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Dokumen Terupload</h3>
          {files.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">Belum ada dokumen</div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {files.map((file, i) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-xl p-4 flex items-center justify-between glass-hover"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-red-400">PDF</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{file.filename}</p>
                        <p className="text-xs text-gray-500">{file.total_chunks} chunks &bull; {(file.file_size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        file.status === "completed" ? "bg-green-500/10 text-green-400" : file.status === "processing" ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {file.status === "completed" ? "Selesai" : file.status === "processing" ? "Proses" : "Gagal"}
                      </span>
                      <button onClick={() => deleteFile(file.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
