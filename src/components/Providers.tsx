"use client";

import { SessionProvider } from "next-auth/react";
import ThemeToggle from "@/components/ui/ThemeToggle";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ThemeToggle />
    </SessionProvider>
  );
}
