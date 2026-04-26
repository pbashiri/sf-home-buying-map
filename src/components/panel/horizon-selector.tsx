"use client";

import type { Horizon } from "@/types/concern";
import { motion } from "framer-motion";
import posthog from "posthog-js";
import { useEffect, useId } from "react";

const HORIZONS: Horizon[] = [5, 7, 10, 15];

type Props = {
  value: Horizon;
  onChange: (h: Horizon) => void;
};

export default function HorizonSelector({ value, onChange }: Props) {
  const layoutId = useId();

  // Keyboard shortcut: H cycles
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key === "h" || e.key === "H") {
        const i = HORIZONS.indexOf(value);
        const next = HORIZONS[(i + 1) % HORIZONS.length];
        if (next !== undefined) onChange(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange]);

  return (
    <div
      role="radiogroup"
      aria-label="Time horizon"
      className="relative inline-flex items-center rounded-full border border-black/10 bg-black/[0.04] p-1 text-[13px] font-semibold"
    >
      {HORIZONS.map((h) => {
        const active = h === value;
        return (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              posthog.capture("horizon_changed", { horizon: h, previous_horizon: value });
              onChange(h);
            }}
            className={`tabular relative z-10 px-3 py-1 transition-colors ${
              active
                ? "text-[color:var(--color-ink)]"
                : "text-[color:var(--color-text-3)] hover:text-[color:var(--color-text-2)]"
            }`}
          >
            <span className="relative z-10">{h}y</span>
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_-4px_rgba(0,0,0,0.18)]"
                transition={{ type: "spring", duration: 0.3, bounce: 0.18 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
