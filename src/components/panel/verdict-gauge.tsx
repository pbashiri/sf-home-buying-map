"use client";

import { motion } from "framer-motion";

type Verdict = "alert" | "watch" | "neutral" | "favor" | undefined;

const COPY: Record<NonNullable<Verdict>, { label: string; sub: string; color: string; tint: string }> = {
  alert: {
    label: "Heads up",
    sub: "Significant concerns at this horizon",
    color: "var(--color-alert)",
    tint: "rgba(155, 28, 28, 0.10)",
  },
  watch: {
    label: "Watch",
    sub: "Worth keeping an eye on",
    color: "var(--color-watch)",
    tint: "rgba(163, 83, 27, 0.10)",
  },
  neutral: {
    label: "Mixed",
    sub: "Concerns and positives in balance",
    color: "var(--color-text-2)",
    tint: "rgba(82, 82, 82, 0.08)",
  },
  favor: {
    label: "In favor",
    sub: "Notable positives at this horizon",
    color: "var(--color-favor)",
    tint: "rgba(15, 95, 51, 0.10)",
  },
};

type Props = {
  verdict: Verdict;
  loading?: boolean;
};

/**
 * The "verdict gauge" — large iconic chip showing the LLM's overall call.
 * Renders a skeleton while the verdict streams in.
 */
export default function VerdictGauge({ verdict, loading }: Props) {
  if (!verdict || loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-black/[0.025] px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-black/10" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-1/3 animate-pulse rounded bg-black/10" />
          <div className="h-2.5 w-2/3 animate-pulse rounded bg-black/[0.07]" />
        </div>
      </div>
    );
  }
  const c = COPY[verdict];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 rounded-2xl border border-black/[0.06] px-4 py-3"
      style={{ background: c.tint }}
    >
      <div
        className="relative flex h-9 w-9 items-center justify-center rounded-full"
        style={{ background: c.color }}
        aria-hidden
      >
        <span className="font-display text-base text-white" style={{ letterSpacing: "-0.02em" }}>
          {c.label[0]}
        </span>
        <span
          className="absolute inset-0 -z-10 rounded-full"
          style={{ background: c.color, filter: "blur(10px)", opacity: 0.35 }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base leading-none" style={{ color: c.color }}>
          {c.label}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-[color:var(--color-text-2)]">{c.sub}</p>
      </div>
    </motion.div>
  );
}
