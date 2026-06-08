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
  uploaded_by?: { name: string; email: string } | null;
  bot_name?: string | null;
  source_type?: "pdf" | "faq";
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
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<{ content: string; metadata: Record<string, unknown> }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const openPreview = async (file: FileItem) => {
    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewContent([]);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.filename, botId: file.ai_bot_id }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewContent(data.chunks || []);
      }
    } catch {
      // silently fail
    }
    setPreviewLoading(false);
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
                    className="glass rounded-xl p-4 glass-hover"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                          file.source_type === "faq"
                            ? "bg-green-500/10 border-green-500/20"
                            : "bg-red-500/10 border-red-500/20"
                        }`}>
                          <span className={`text-xs font-bold ${
                            file.source_type === "faq" ? "text-green-400" : "text-red-400"
                          }`}>
                            {file.source_type === "faq" ? "FAQ" : "PDF"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{file.filename}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-xs text-gray-500">{file.total_chunks} chunks</span>
                            <span className="text-xs text-gray-600">&bull;</span>
                            <span className="text-xs text-gray-500">{(file.file_size / 1024).toFixed(1)} KB</span>
                            {file.bot_name && (
                              <>
                                <span className="text-xs text-gray-600">&bull;</span>
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{file.bot_name}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-xs text-gray-500">
                              {new Date(file.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                            {file.uploaded_by && (
                              <>
                                <span className="text-xs text-gray-600">&bull;</span>
                                <span className="text-xs text-gray-400">oleh {file.uploaded_by.name || file.uploaded_by.email}</span>
                              </>
                            )}
                            {file.source_type === "faq" && (
                              <>
                                <span className="text-xs text-gray-600">&bull;</span>
                                <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 text-xs">Dari Laporan/Pertanyaan</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          file.status === "completed" ? "bg-green-500/10 text-green-400" : file.status === "processing" ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"
                        }`}>
                          {file.status === "completed" ? "Selesai" : file.status === "processing" ? "Proses" : "Gagal"}
                        </span>
                        <button
                          onClick={() => openPreview(file)}
                          className="p-2 rounded-lg hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-400 transition-all"
                          title="Preview"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button onClick={() => deleteFile(file.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all" title="Hapus">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Preview Modal */}
        <AnimatePresence>
          {previewFile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-white/10 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      previewFile.source_type === "faq" ? "bg-green-500/20" : "bg-red-500/20"
                    }`}>
                      <span className={`text-xs font-bold ${
                        previewFile.source_type === "faq" ? "text-green-400" : "text-red-400"
                      }`}>
                        {previewFile.source_type === "faq" ? "FAQ" : "PDF"}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm truncate max-w-md">{previewFile.filename}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">
                          {new Date(previewFile.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                        {previewFile.uploaded_by && (
                          <>
                            <span className="text-xs text-gray-600">&bull;</span>
                            <span className="text-xs text-gray-400">oleh {previewFile.uploaded_by.name || previewFile.uploaded_by.email}</span>
                          </>
                        )}
                        {previewFile.bot_name && (
                          <>
                            <span className="text-xs text-gray-600">&bull;</span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{previewFile.bot_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setPreviewFile(null)} className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 ml-4">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Info bar */}
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-4 flex-shrink-0">
                  <span className="text-xs text-gray-500">{previewFile.total_chunks} chunks</span>
                  <span className="text-xs text-gray-500">{(previewFile.file_size / 1024).toFixed(1)} KB</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    previewFile.source_type === "faq"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}>
                    {previewFile.source_type === "faq" ? "Jawaban Manual (FAQ)" : "Upload PDF"}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
                  {previewLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
                      ))}
                    </div>
                  ) : previewContent.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Tidak ada konten preview tersedia
                    </div>
                  ) : (
                    previewContent.map((chunk, i) => (
                      <div key={i} className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500 font-medium">Chunk {i + 1}</span>
                          {chunk.metadata?.page_number != null && (
                            <span className="text-xs text-gray-600">&bull; Halaman {Number(chunk.metadata.page_number)}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{chunk.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-white/10 flex-shrink-0 flex justify-end">
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all"
                  >
                    Tutup
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
