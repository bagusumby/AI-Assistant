"use client";

import { motion, AnimatePresence } from "framer-motion";

interface NavigationWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function NavigationWarningModal({ isOpen, onConfirm, onCancel }: NavigationWarningModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-2xl p-6 w-full max-w-sm border border-white/10 mx-4"
          >
            {/* Warning icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            </div>

            <h3 className="text-lg font-bold text-center mb-2">Proses Sedang Berjalan</h3>
            <p className="text-gray-400 text-sm text-center mb-6">
              Ada proses yang sedang berjalan (upload/chat). Jika Anda meninggalkan halaman, proses akan dibatalkan. Yakin ingin melanjutkan?
            </p>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-medium text-sm transition-all border border-white/10"
              >
                Tetap di Halaman
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onConfirm}
                className="flex-1 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium text-sm transition-all border border-red-500/30"
              >
                Tinggalkan
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
