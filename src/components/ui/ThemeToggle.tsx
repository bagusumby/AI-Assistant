"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "rag-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial: Theme = saved === "light" ? "light" : "dark";
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Aktifkan light mode" : "Aktifkan dark mode"}
      title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
      className="fixed bottom-5 right-5 z-[70] glass rounded-full p-3 text-gray-300 hover:text-white transition-all"
    >
      {theme === "dark" ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m8.25-9H21M3 12h1.5m13.864 5.364l1.06 1.06M4.576 4.576l1.06 1.06m12.728-1.06l-1.06 1.06M5.636 18.364l-1.06 1.06M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.267-2.597.752-3.752a9.753 9.753 0 00-6.502 9.227c0 5.385 4.365 9.75 9.75 9.75a9.753 9.753 0 009.227-6.223z" />
        </svg>
      )}
    </button>
  );
}
