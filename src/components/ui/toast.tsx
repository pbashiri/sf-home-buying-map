"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastKind = "success" | "info" | "error";
type Toast = { id: number; kind: ToastKind; text: string };

type Ctx = {
  push: (kind: ToastKind, text: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // No-op in non-provider environments (SSR, tests). Returning a stub keeps callers safe.
    return { push: () => {} };
  }
  return ctx;
}

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2400);
  }, []);

  const value = useMemo<Ctx>(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="no-print pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ y: -16, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -10, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="surface-glass pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-xl"
              role="status"
            >
              <Icon kind={t.kind} />
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

function Icon({ kind }: { kind: ToastKind }) {
  if (kind === "success") {
    return <CheckCircle2 className="h-4 w-4 text-[color:var(--color-favor)]" aria-hidden />;
  }
  if (kind === "error") {
    return <TriangleAlert className="h-4 w-4 text-[color:var(--color-alert)]" aria-hidden />;
  }
  return <Info className="h-4 w-4 text-[color:var(--color-text-2)]" aria-hidden />;
}

export { X };
