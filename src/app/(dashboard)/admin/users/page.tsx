"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  label: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "user" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (data.users) {
      setUsers(data.users);
      setRoles(data.roles || []);
    } else {
      setUsers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "user" });
    setError("");
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, password: "", role: user.role });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";
      const body = editingUser
        ? { id: editingUser.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan");
      } else {
        setShowModal(false);
        fetchUsers();
      }
    } catch {
      setError("Terjadi kesalahan");
    }
    setSaving(false);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Yakin ingin menghapus user ini?")) return;

    const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Kelola Users</h1>
            <p className="text-gray-400 text-sm">Tambah, edit, dan hapus pengguna</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-medium text-sm transition-all"
          >
            + Tambah User
          </motion.button>
        </div>

        {/* Users table */}
        <div className="glass rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Nama</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Role</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Dibuat</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="h-4 bg-white/10 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Belum ada user
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm">{user.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-500/20 text-gray-300">
                          {roles.find((r) => r.name === user.role)?.label || user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(user.created_at).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEdit(user)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-md border border-white/10"
            >
              <h2 className="text-lg font-bold mb-4">
                {editingUser ? "Edit User" : "Tambah User Baru"}
              </h2>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Nama</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">
                    Password {editingUser && <span className="text-gray-600">(kosongkan jika tidak diubah)</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white"
                    {...(!editingUser ? { required: true } : {})}
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.name} className="bg-gray-900">{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium text-sm transition-all"
                  >
                    Batal
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-medium text-sm transition-all disabled:opacity-50"
                  >
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
