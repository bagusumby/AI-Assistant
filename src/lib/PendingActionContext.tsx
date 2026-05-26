"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { NavigationWarningModal } from "@/components/ui/NavigationWarningModal";

interface PendingActionContextType {
  isPending: boolean;
  setPending: (pending: boolean) => void;
  confirmNavigation: () => boolean;
  requestNavigation: (onConfirm: () => void) => void;
}

const PendingActionContext = createContext<PendingActionContextType>({
  isPending: false,
  setPending: () => {},
  confirmNavigation: () => true,
  requestNavigation: () => {},
});

export function PendingActionProvider({ children }: { children: ReactNode }) {
  const [isPending, setIsPending] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  const setPending = useCallback((pending: boolean) => {
    setIsPending(pending);
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!isPending) return true;
    // For synchronous checks (like Link onClick), we can't show modal
    // So we use requestNavigation for async flow
    return false;
  }, [isPending]);

  const requestNavigation = useCallback((onConfirm: () => void) => {
    if (!isPending) {
      onConfirm();
      return;
    }
    setPendingCallback(() => onConfirm);
    setShowWarning(true);
  }, [isPending]);

  const handleConfirm = () => {
    setShowWarning(false);
    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  };

  const handleCancel = () => {
    setShowWarning(false);
    setPendingCallback(null);
  };

  return (
    <PendingActionContext.Provider value={{ isPending, setPending, confirmNavigation, requestNavigation }}>
      {children}
      <NavigationWarningModal
        isOpen={showWarning}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </PendingActionContext.Provider>
  );
}

export function usePendingAction() {
  return useContext(PendingActionContext);
}
