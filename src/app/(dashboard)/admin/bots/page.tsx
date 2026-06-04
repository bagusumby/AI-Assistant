"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AiBot {
  id: string;
  name: string;
  slug: string;
  description?: string;
  manager_role_id?: string;
  chat_enabled: boolean;
  system_prompt?: string;
  created_at: string;
  role?: { id: string; label: string; name: string };
}

interface Role {
  id: string;
  name: string;
  label: string;
  type: string;
}

export default function AdminBotsPage() {
  const [bots, setBots] = useState<AiBot[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBot, setEditingBot] = useState<AiBot | null>(null);
  const [formData, setFormData] = useState({
    name: "", slug: "", description: "", manager_role_id: "", chat_enabled: true, system_prompt: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [botsRes, rolesRes] = await Promise.all([
      fetch("/api/admin/bots"),
      fetch("/api/admin/roles"),
    ]);
    if (botsRes.ok) setBots(await botsRes.json());
    if (rolesRes.ok) {
      const allRoles: Role[] = await rolesRes.json();
      setRoles(allRoles.filter((r) => r.type === "manager"));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditingBot(null);
    setFormData({ name: "", slug: "", description: "", manager_role_id: "", chat_enabled: true, system_prompt: "" });
    setError("");
    setShowModal(true);
  };

  const openEdit = (bot: AiBot) => {
    setEditingBot(bot);
    setFormData({
      name: bot.name, slug: bot.slug, description: bot.description || "",
      manager_role_id: bot.manager_role_id || "", chat_enabled: bot.chat_enabled,
      system_prompt: bot.system_prompt || "",
    });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body = {
      name: formData.name,
      description: formData.description,
      manager_role_id: formData.manager_role_id || null,
      chat_enabled: formData.chat_enabled,
      system_prompt: formData.system_prompt,
      ...(editingBot ? {} : { slug: formData.slug }),
    };

    try {
      const url = editingBot ? `/api/admin/bots/${editingBot.id}` : "/api/admin/bots";
      const method = editingBot ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan");
      } else {
        setShowModal(false);
        fetchData();
      }
    } catch {
      setError("Terjadi kesalahan");
    }
    setSaving(false);
  };

  const toggleChat = async (bot: AiBot) => {
    setTogglingId(bot.id);
    await fetch(`/api/admin/bots/${bot.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_enabled: !bot.chat_enabled }),
    });
    await fetchData();
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus bot ini? Semua dokumen terkait akan ikut terhapus.")) return;
    const res = await fetch(`/api/admin/bots/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Gagal menghapus");
    else fetchData();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Kelola AI Bots</h1>
            <p className="text-gray-400 text-sm">Konfigurasi bot, knowledge base, dan akses chat</p>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-medium text-sm transition-all">
            + Tambah Bot
          </motion.button>
        </div>

        <div className="glass rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Bot</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Slug</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Manager Role</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-gray-400">Chat</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-white/10 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : bots.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada bot</td></tr>
              ) : (
                bots.map((bot) => (
                  <tr key={bot.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-white">{bot.name}</p>
                      {bot.description && <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{bot.description}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-400">{bot.slug}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{bot.role?.label || "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => toggleChat(bot)}
                          disabled={togglingId === bot.id}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bot.chat_enabled ? "bg-green-500" : "bg-gray-600"} ${togglingId === bot.id ? "opacity-50" : ""}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${bot.chat_enabled ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openEdit(bot)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all mr-2">Edit</button>
                      <button onClick={() => handleDelete(bot.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all">Hapus</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10">
              <h2 className="text-lg font-bold mb-4">{editingBot ? "Edit AI Bot" : "Tambah AI Bot Baru"}</h2>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Nama Bot</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white" required />
                </div>
                {!editingBot && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Slug (unik, lowercase)</label>
                    <input type="text" value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                      pattern="[a-z0-9-]+" placeholder="contoh: ta-bot"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white font-mono" required />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Deskripsi</label>
                  <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Manager Role</label>
                  <select value={formData.manager_role_id} onChange={(e) => setFormData({ ...formData, manager_role_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 outline-none transition-all text-white">
                    <option value="" className="bg-gray-900">-- Tidak ada --</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id} className="bg-gray-900">{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                  <label className="text-sm text-gray-300">Chat diaktifkan</label>
                  <button type="button" onClick={() => setFormData({ ...formData, chat_enabled: !formData.chat_enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.chat_enabled ? "bg-green-500" : "bg-gray-600"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.chat_enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">System Prompt</label>
                  <textarea value={formData.system_prompt} onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    rows={5} placeholder="Instruksi kustom untuk bot ini. Gunakan {context} untuk memasukkan hasil pencarian dokumen."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none transition-all text-white text-sm" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium text-sm transition-all">Batal</button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-medium text-sm transition-all disabled:opacity-50">
                    {saving ? "Menyimpan..." : "Simpan"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
