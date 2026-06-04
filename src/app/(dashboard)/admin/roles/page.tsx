"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

interface Role {
  id: string;
  name: string;
  label: string;
  description?: string;
  type: string;
  created_at: string;
}

const typeColor: Record<string, string> = {
  system: "bg-indigo-500/20 text-indigo-300",
  manager: "bg-orange-500/20 text-orange-300",
  user: "bg-gray-500/20 text-gray-300",
};

export default function AdminRolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    const res = await fetch("/api/admin/roles");
    if (res.ok) setRoles(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoles();
  }, [fetchRoles]);

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus role ini?")) return;
    const res = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Gagal menghapus");
    } else {
      fetchRoles();
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Kelola Role</h1>
            <p className="text-gray-400 text-sm">Atur role dan akses menu pengguna</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/admin/roles/new")}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-medium text-sm transition-all"
          >
            + Tambah Role
          </motion.button>
        </div>

        <div className="glass rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Nama (Slug)</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Label</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Tipe</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Deskripsi</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="h-4 bg-white/10 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada role</td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-gray-300">{role.name}</td>
                      <td className="px-6 py-4 text-sm font-medium">{role.label}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeColor[role.type] || typeColor.user}`}>
                          {role.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400 max-w-xs truncate">{role.description || "—"}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => router.push(`/admin/roles/${role.id}/edit`)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
                        >
                          Edit
                        </button>
                        {role.type !== "system" && (
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
