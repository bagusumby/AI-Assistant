"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Menu {
  id: string;
  label: string;
  path: string;
  icon?: string;
  sort_order: number;
}

interface Role {
  id: string;
  name: string;
  label: string;
  type: string;
}

export default function AdminMenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [formData, setFormData] = useState({ label: "", path: "", icon: "", sort_order: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [menuRoles, setMenuRoles] = useState<Record<string, Role[]>>({});

  const fetchData = useCallback(async () => {
    const [menusRes, rolesRes] = await Promise.all([
      fetch("/api/admin/menus"),
      fetch("/api/admin/roles"),
    ]);
    if (menusRes.ok) setMenus(await menusRes.json());
    if (rolesRes.ok) setRoles(await rolesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadMenuRoles = async (menuId: string) => {
    if (menuRoles[menuId]) return;
    const res = await fetch(`/api/admin/menus/${menuId}/permissions`);
    if (res.ok) {
      const data = await res.json();
      setMenuRoles((prev) => ({ ...prev, [menuId]: data }));
    }
  };

  const toggleExpand = async (menuId: string) => {
    if (expandedMenu === menuId) {
      setExpandedMenu(null);
    } else {
      setExpandedMenu(menuId);
      await loadMenuRoles(menuId);
    }
  };

  const toggleRolePermission = async (menuId: string, roleId: string, hasAccess: boolean) => {
    if (hasAccess) {
      await fetch(`/api/admin/menus/${menuId}/permissions?roleId=${roleId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/admin/menus/${menuId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
    }
    const res = await fetch(`/api/admin/menus/${menuId}/permissions`);
    if (res.ok) {
      const data = await res.json();
      setMenuRoles((prev) => ({ ...prev, [menuId]: data }));
    }
  };

  const openCreate = () => {
    setEditingMenu(null);
    setFormData({ label: "", path: "", icon: "", sort_order: menus.length });
    setError("");
    setShowModal(true);
  };

  const openEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setFormData({ label: menu.label, path: menu.path, icon: menu.icon || "", sort_order: menu.sort_order });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editingMenu ? `/api/admin/menus/${editingMenu.id}` : "/api/admin/menus";
      const method = editingMenu ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Gagal menyimpan");
      else { setShowModal(false); fetchData(); }
    } catch { setError("Terjadi kesalahan"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus menu ini?")) return;
    const res = await fetch(`/api/admin/menus/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Gagal menghapus");
    else fetchData();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Kelola Menus</h1>
            <p className="text-gray-400 text-sm">Pengaturan menu navigasi dan permission role</p>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-medium text-sm transition-all">
            + Tambah Menu
          </motion.button>
        </div>

        <div className="space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="glass rounded-xl p-4 animate-pulse h-16" />
            ))
          ) : menus.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm glass rounded-xl">Belum ada menu</div>
          ) : (
            menus.map((menu) => (
              <div key={menu.id} className="glass rounded-xl border border-white/10 overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {menu.icon && <span className="text-sm text-gray-400 font-mono text-xs">{menu.icon}</span>}
                      <span className="font-medium text-sm">{menu.label}</span>
                      <span className="text-xs text-gray-500 font-mono">{menu.path}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">sort: {menu.sort_order}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleExpand(menu.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-all ${expandedMenu === menu.id ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 hover:bg-white/10 text-gray-300"}`}>
                      Permissions {expandedMenu === menu.id ? "▲" : "▼"}
                    </button>
                    <button onClick={() => openEdit(menu)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all">Edit</button>
                    <button onClick={() => handleDelete(menu.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all">Hapus</button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedMenu === menu.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/10 overflow-hidden">
                      <div className="px-4 py-3 bg-black/20">
                        <p className="text-xs text-gray-500 mb-2">Role yang punya akses ke menu ini:</p>
                        <div className="flex flex-wrap gap-2">
                          {roles.map((role) => {
                            const hasAccess = (menuRoles[menu.id] || []).some((r) => r.id === role.id);
                            return (
                              <button key={role.id} onClick={() => toggleRolePermission(menu.id, role.id, hasAccess)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                  hasAccess
                                    ? "bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/10"
                                    : "bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-400"
                                }`}>
                                {hasAccess ? "✓ " : ""}{role.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-md border border-white/10">
              <h2 className="text-lg font-bold mb-4">{editingMenu ? "Edit Menu" : "Tambah Menu Baru"}</h2>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Label</label>
                  <input type="text" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Path</label>
                  <input type="text" value={formData.path} onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    placeholder="/chat" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white font-mono" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Icon (nama icon)</label>
                  <input type="text" value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="chat / upload / admin / users / roles / bots / menus"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Sort Order</label>
                  <input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-white" />
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
