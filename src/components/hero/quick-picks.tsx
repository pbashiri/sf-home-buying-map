"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useId } from "react";

export type QuickPick = {
  label: string;
  /** What the search will type — used as a Google Places query. */
  query: string;
  /** Optional precomputed coords for instant fly-to without a geocode round-trip. */
  lat?: number;
  lng?: number;
};

export const QUICK_PICKS: QuickPick[] = [
  { label: "Pacific Heights", query: "Pacific Heights, San Francisco, CA" },
  { label: "Mission", query: "Mission District, San Francisco, CA" },
  { label: "Outer Sunset", query: "Outer Sunset, San Francisco, CA" },
];

type Props = {
  onPick: (q: QuickPick) => void;
};

export default function QuickPicks({ onPick }: Props) {
  const id = useId();
  return (
    <ul aria-label="Try a neighborhood" className="flex flex-wrap items-center justify-center gap-1.5">
      {QUICK_PICKS.map((p, i) => (
        <motion.li
          key={`${id}-${p.label}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.2 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            onClick={() => onPick(p)}
            className="surface-glass group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-2)] shadow-sm transition-all hover:-translate-y-px hover:text-[color:var(--color-ink)] hover:shadow-md"
          >
            {p.label}
            <ArrowUpRight
              className="h-3 w-3 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
              aria-hidden
            />
          </button>
        </motion.li>
      ))}
    </ul>
  );
}
