"use client";

import type { Severity } from "@/types/concern";
import { motion } from "framer-motion";

type Props = {
  counts: Record<Severity, number>;
};

/**
 * Single-line distribution bar showing the proportion of alert/watch/favor/context
 * concerns at this address. Tabular numbers under the bar.
 */
export default function SeverityBar({ counts }: Props) {
  const total = counts.alert + counts.watch + counts.favor + counts.context;
  if (total === 0) return null;

  const allSegs: Array<{ key: Severity; pct: number; color: string; label: string }> = [
    { key: "alert", pct: (counts.alert / total) * 100, color: "var(--color-alert)", label: "Alert" },
    { key: "watch", pct: (counts.watch / total) * 100, color: "var(--color-watch)", label: "Watch" },
    { key: "favor", pct: (counts.favor / total) * 100, color: "var(--color-favor)", label: "Favor" },
    {
      key: "context",
      pct: (counts.context / total) * 100,
      color: "var(--color-text-3)",
      label: "Context",
    },
  ];
  const segs = allSegs.filter((s) => s.pct > 0);

  return (
    <div>
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]"
        role="img"
        aria-label={`${total} concerns: ${counts.alert} alert, ${counts.watch} watch, ${counts.favor} favor, ${counts.context} context`}
      >
        {segs.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: s.color }}
            title={`${s.label}: ${counts[s.key]}`}
          />
        ))}
      </div>
      <div className="tabular mt-2 flex items-center gap-3 text-[11px] text-[color:var(--color-text-3)]">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: s.color }}
            />
            <span>
              <span className="font-medium text-[color:var(--color-text-2)]">{counts[s.key]}</span>{" "}
              {s.label.toLowerCase()}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
