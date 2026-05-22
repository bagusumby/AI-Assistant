"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface PendingActionContextType {
  isPending: boolean;
  setPending: (pending: boolean) => void;
  confirmNavigation: () => boolean;
}

const PendingActionContext = createContext<PendingActionContextType>({
  isPending: false,
  setPending: () => {},
  confirmNavigation: () => true,
});

export function PendingActionProvider({ children }: { children: ReactNode }) {
  const [isPending, setIsPending] = useState(false);

  const setPending = useCallback((pending: boolean) => {
    setIsPending(pending);
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!isPending) return true;
    return window.confirm(
      "Proses sedang berjalan. Jika Anda meninggalkan halaman, aksi akan gagal. Lanjutkan?"
    );
  }, [isPending]);

  return (
    <PendingActionContext.Provider value={{ isPending, setPending, confirmNavigation }}>
      {children}
    </PendingActionContext.Provider>
  );
}

export function usePendingAction() {
  return useContext(PendingActionContext);
}
