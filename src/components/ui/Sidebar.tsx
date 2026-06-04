"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { usePendingAction } from "@/lib/PendingActionContext";
import { useState, useEffect } from "react";

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string; roleType?: string };
}

interface MenuEntry {
  id: string;
  label: string;
  path: string;
  icon: string;
  sort_order: number;
}

function MenuIcon({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    chat: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    upload: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
    admin: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    roles: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    bots: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    menus: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    ),
    default: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  };
  return <>{icons[icon] || icons.default}</>;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPending, requestNavigation } = usePendingAction();
  const [menus, setMenus] = useState<MenuEntry[]>([]);

  const roleLabel: Record<string, string> = {
    admin: "Admin",
    ta_manager: "TA Manager",
    it_dev_manager: "IT Dev Manager",
    hc_manager: "HC Manager",
    compliance_manager: "Compliance Manager",
  };

  useEffect(() => {
    fetch("/api/menus")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMenus(data);
      })
      .catch(() => {});
  }, []);

  const handleNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (pathname === href || pathname.startsWith(href + "/")) return;

    if (isPending) {
      requestNavigation(() => router.push(href));
    } else {
      router.push(href);
    }
  };

  const displayRole = user.role ? (roleLabel[user.role] || user.role) : "";

  return (
    <motion.aside
      initial={{ x: -80 }}
      animate={{ x: 0 }}
      className="w-64 h-screen glass border-r border-white/10 flex flex-col"
    >
      {/* Brand */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-sm gradient-text">RAG AI Assistant</h1>
            <p className="text-xs text-gray-500">Private Knowledge</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menus.map((menu, index) => {
          const isActive = pathname === menu.path || pathname.startsWith(menu.path + "/");
          const prevMenu = menus[index - 1];
          const isAdminSection = menu.path.startsWith("/admin");
          const prevIsAdminSection = prevMenu?.path.startsWith("/admin");
          const showDivider = isAdminSection && !prevIsAdminSection;
          return (
            <div key={menu.id}>
              {showDivider && (
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Administrasi</p>
                </div>
              )}
              <Link
                href={menu.path}
                onClick={(e) => handleNavigation(e, menu.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <MenuIcon icon={menu.icon} />
                {menu.label}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            {displayRole && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">{displayRole}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            if (isPending) {
              requestNavigation(() => signOut({ callbackUrl: "/login" }));
            } else {
              signOut({ callbackUrl: "/login" });
            }
          }}
          className="w-full px-3 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
        >
          Keluar
        </button>
      </div>
    </motion.aside>
  );
}

