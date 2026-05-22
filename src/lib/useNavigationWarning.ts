"use client";

import { useEffect } from "react";
import { usePendingAction } from "./PendingActionContext";

/**
 * Hook to warn users when they try to navigate away or refresh
 * while an async operation (upload/chat) is in progress.
 */
export function useNavigationWarning(isActive: boolean) {
  const { setPending } = usePendingAction();

  // Sync pending state with context for sidebar navigation interception
  useEffect(() => {
    setPending(isActive);
    return () => setPending(false);
  }, [isActive, setPending]);

  // Handle browser refresh/close/URL bar navigation
  useEffect(() => {
    if (!isActive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Proses sedang berjalan. Jika Anda meninggalkan halaman, aksi akan gagal.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isActive]);
}
