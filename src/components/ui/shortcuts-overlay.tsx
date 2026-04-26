"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";

const ROWS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/"], label: "Focus address search" },
  { keys: ["Esc"], label: "Clear address / close" },
  { keys: ["H"], label: "Cycle time horizon (5 → 7 → 10 → 15)" },
  { keys: ["1", "8"], label: "Toggle map layers 1–8" },
  { keys: ["?"], label: "Show this help" },
  { keys: ["⌘", "K"], label: "Quick search" },
];

export default function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (e.key === "?" && !inField) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("input[inputmode=search]")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={() => setOpen(true)}
        className="surface-glass no-print fixed top-4 right-4 z-30 flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-text-2)] transition-colors hover:text-[color:var(--color-ink)]"
      >
        <Keyboard className="h-4 w-4" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="no-print fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              key="dialog"
              initial={{ y: 12, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="surface-elevated no-print fixed inset-x-0 top-[18vh] z-[71] mx-auto w-[min(92vw,440px)] rounded-2xl p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
            >
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-[color:var(--color-text-2)]" aria-hidden />
                <h2 className="font-display text-lg">Keyboard shortcuts</h2>
              </div>
              <ul className="mt-4 space-y-2">
                {ROWS.map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-4 py-1.5">
                    <span className="text-sm text-[color:var(--color-text-2)]">{r.label}</span>
                    <span className="flex items-center gap-1">
                      {r.keys.map((k, i) => (
                        <span key={k} className="flex items-center gap-1">
                          {i > 0 && <span className="text-xs text-[color:var(--color-text-3)]">–</span>}
                          <kbd className="font-mono inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-black/10 bg-black/[0.04] px-1.5 text-[11px] font-medium tabular shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-[color:var(--color-text-3)]">
                Press <kbd className="rounded bg-black/5 px-1">Esc</kbd> to close.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
