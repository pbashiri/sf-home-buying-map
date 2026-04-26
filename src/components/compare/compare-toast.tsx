"use client";

import type { AddressUrlState } from "@/lib/url";
import { compareSerialise } from "@/lib/url";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import posthog from "posthog-js";

type Props = {
  saved: AddressUrlState[];
  onClear: () => void;
};

export default function CompareToast({ saved, onClear }: Props) {
  const visible = saved.length >= 2;
  const href = visible
    ? (`/compare?addrs=${encodeURIComponent(compareSerialise(saved))}` as Route)
    : ("/compare" as Route);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="compare-toast"
          initial={{ y: 12, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="no-print fixed inset-x-0 bottom-12 z-30 flex justify-center"
        >
          <div className="surface-glass flex items-center gap-2 rounded-full pl-4 pr-2 py-1.5 text-sm shadow-xl">
            <span className="font-mono inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[color:var(--color-ink)] px-2 text-[11px] font-semibold tabular text-white">
              {saved.length}
            </span>
            <span className="font-medium">saved</span>
            <Link
              href={href}
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-ink)] px-3 py-1 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              Compare <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
            <button
              type="button"
              aria-label="Clear compare list"
              onClick={() => {
                posthog.capture("compare_cleared", { address_count: saved.length });
                onClear();
              }}
              className="ml-1 rounded-full p-1.5 text-[color:var(--color-text-3)] transition-colors hover:bg-black/5 hover:text-[color:var(--color-ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
