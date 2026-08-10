"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/lib/useDebounce";
import Pagination from "@/components/ui/Pagination";

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

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [nameFilter, setNameFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const debouncedName = useDebounce(nameFilter);
  const debouncedLabel = useDebounce(labelFilter);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedName) params.set("name", debouncedName);
    if (debouncedLabel) params.set("label", debouncedLabel);
    if (typeFilter) params.set("type", typeFilter);

    const res = await fetch(`/api/admin/roles?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRoles(data.roles || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
  }, [page, limit, debouncedName, debouncedLabel, typeFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRoles();
  }, [fetchRoles]);

  // Reset to first page whenever a filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedName, debouncedLabel, typeFilter]);

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
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-6 py-2">
                    <input
                      type="text"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder="Cari nama (slug)..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                    />
                  </th>
                  <th className="px-6 py-2">
                    <input
                      type="text"
                      value={labelFilter}
                      onChange={(e) => setLabelFilter(e.target.value)}
                      placeholder="Cari label..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                    />
                  </th>
                  <th className="px-6 py-2">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="" className="bg-gray-900">Semua tipe</option>
                      <option value="system" className="bg-gray-900">system</option>
                      <option value="manager" className="bg-gray-900">manager</option>
                      <option value="user" className="bg-gray-900">user</option>
                    </select>
                  </th>
                  <th className="px-6 py-2" />
                  <th className="px-6 py-2" />
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
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </div>
      </motion.div>

    </div>
  );
}
