"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

interface MenuOption {
  id: string;
  label: string;
  path: string;
  icon: string;
}

interface Role {
  id: string;
  name: string;
  label: string;
  description?: string;
  type: string;
}

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [selectedMenus, setSelectedMenus] = useState<string[]>([]);
  const [formData, setFormData] = useState({ label: "", description: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/roles`).then((r) => r.json()),
      fetch("/api/admin/menus").then((r) => r.json()),
      fetch(`/api/admin/roles/${id}/permissions`).then((r) => r.json()),
    ]).then(([roles, menuData, permData]) => {
      const found = Array.isArray(roles) ? roles.find((r: Role) => r.id === id) : null;
      if (found) {
        setRole(found);
        setFormData({ label: found.label, description: found.description || "" });
      }
      if (Array.isArray(menuData)) setMenus(menuData);
      if (Array.isArray(permData)) setSelectedMenus(permData);
    }).finally(() => setLoading(false));
  }, [id]);

  const toggleMenu = (menuId: string) => {
    setSelectedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((m) => m !== menuId) : [...prev, menuId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // 1. Update role label/description
      const roleRes = await fetch(`/api/admin/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: formData.label, description: formData.description }),
      });
      const roleData = await roleRes.json();
      if (!roleRes.ok) {
        setError(roleData.error || "Gagal menyimpan");
        setSaving(false);
        return;
      }

      // 2. Update menu permissions
      await fetch(`/api/admin/roles/${id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuIds: selectedMenus }),
      });

      router.push("/admin/roles");
    } catch {
      setError("Terjadi kesalahan");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Memuat...</div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Role tidak ditemukan</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/admin/roles")}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Edit Role</h1>
            <p className="text-gray-400 text-sm font-mono">{role.name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Role Info */}
          <div className="glass rounded-xl border border-white/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Informasi Role</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Nama (Slug)</label>
              <div className="w-full px-4 py-3 rounded-xl bg-white/3 border border-white/5 text-gray-500 font-mono text-sm">
                {role.name}
              </div>
              <p className="text-xs text-gray-600 mt-1">Nama slug tidak dapat diubah</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Label</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Deskripsi <span className="text-gray-600 text-xs">(opsional)</span></label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Deskripsi singkat role ini"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white placeholder-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Tipe</label>
              <div className="w-full px-4 py-3 rounded-xl bg-white/3 border border-white/5 text-gray-500 text-sm capitalize">
                {role.type}
              </div>
              <p className="text-xs text-gray-600 mt-1">Tipe tidak dapat diubah</p>
            </div>
          </div>

          {/* Menu Access */}
          <div className="glass rounded-xl border border-white/10 p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Akses Menu</h2>
            <p className="text-gray-500 text-xs mb-4">Pilih menu yang dapat diakses oleh role ini</p>

            {menus.length === 0 ? (
              <p className="text-gray-500 text-sm">Tidak ada menu tersedia</p>
            ) : (
              <div className="space-y-2">
                {menus.map((menu) => {
                  const checked = selectedMenus.includes(menu.id);
                  return (
                    <label
                      key={menu.id}
                      className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                        checked
                          ? "bg-indigo-500/10 border-indigo-500/40"
                          : "bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMenu(menu.id)}
                        className="w-4 h-4 rounded border-gray-600 text-indigo-500 bg-white/10 focus:ring-indigo-500 focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${checked ? "text-white" : "text-gray-300"}`}>
                          {menu.label}
                        </p>
                        <p className="text-xs text-gray-600 font-mono">{menu.path}</p>
                      </div>
                      {checked && (
                        <span className="text-xs text-indigo-400">✓</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin/roles")}
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
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
