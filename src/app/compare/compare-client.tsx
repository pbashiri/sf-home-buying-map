"use client";

import SeverityBar from "@/components/panel/severity-bar";
import { compareParse } from "@/lib/url";
import type { Concern, ConcernsResponse, Severity } from "@/types/concern";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useMemo, useState } from "react";

type Cell = {
  address: { lat: number; lng: number; label?: string };
  data?: ConcernsResponse;
  loading: boolean;
};

const SEVERITIES: Severity[] = ["alert", "watch", "favor", "context"];
const SEVERITY_LABEL: Record<Severity, string> = {
  alert: "Alert",
  watch: "Watch",
  favor: "Favor",
  context: "Context",
};

function countsFor(cell: Cell): Record<Severity, number> {
  const out: Record<Severity, number> = { alert: 0, watch: 0, favor: 0, context: 0 };
  if (!cell.data) return out;
  for (const c of cell.data.concerns) out[c.severity]++;
  return out;
}

export default function CompareClient() {
  const sp = useSearchParams();
  const addrs = useMemo(() => compareParse(sp.get("addrs") ?? ""), [sp]);
  const [cells, setCells] = useState<Cell[]>([]);

  useEffect(() => {
    if (addrs.length >= 2) {
      posthog.capture("compare_viewed", {
        address_count: addrs.length,
        addresses: addrs.map((a) => a.label ?? `${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}`),
      });
    }
    const init = addrs
      .slice(0, 4)
      .map((a) => ({ address: { lat: a.lat, lng: a.lng, label: a.label }, loading: true }));
    setCells(init);
    init.forEach((c, i) => {
      const horizon = addrs[i]?.horizon ?? 10;
      fetch(`/api/concerns?lat=${c.address.lat}&lng=${c.address.lng}&horizon=${horizon}`)
        .then(async (r) => (await r.json()) as ConcernsResponse)
        .then((data) => {
          setCells((prev) => {
            const next = [...prev];
            const existing = next[i];
            if (!existing) return prev;
            next[i] = { ...existing, data, loading: false };
            return next;
          });
        })
        .catch((err) => {
          console.error("[compare]", err);
          setCells((prev) => {
            const next = [...prev];
            const existing = next[i];
            if (!existing) return prev;
            next[i] = { ...existing, loading: false };
            return next;
          });
        });
    });
  }, [addrs]);

  if (addrs.length === 0) {
    return (
      <p className="mt-8 text-sm text-[color:var(--color-text-3)]">
        No addresses to compare. Save 2 or more from the home page.
      </p>
    );
  }

  return (
    <div
      className="mt-6 grid gap-4"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((cell, i) => {
        const counts = countsFor(cell);
        return (
          <motion.article
            key={`${cell.address.lat}-${cell.address.lng}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="surface-elevated flex flex-col gap-4 rounded-2xl p-5"
          >
            <header>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-3)]">
                {cell.data?.address.neighborhood ?? "San Francisco"}
              </p>
              <h2 className="font-display mt-1 text-lg leading-tight">
                {cell.address.label ?? `${cell.address.lat.toFixed(4)}, ${cell.address.lng.toFixed(4)}`}
              </h2>
            </header>

            {cell.loading && (
              <div className="space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-black/[0.06]" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-black/[0.06]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-black/[0.06]" />
              </div>
            )}

            {cell.data && (
              <>
                <SeverityBar counts={counts} />

                <div className="space-y-3">
                  {SEVERITIES.map((sev) => {
                    const items = cell.data!.concerns.filter((c) => c.severity === sev);
                    if (items.length === 0) return null;
                    return (
                      <div key={sev}>
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-3)]">
                          <span className={`dot dot-${sev}`} aria-hidden /> {SEVERITY_LABEL[sev]} (
                          {items.length})
                        </p>
                        <ul className="mt-1 space-y-1">
                          {items.slice(0, 4).map((c: Concern) => (
                            <li key={c.id} className="text-xs leading-snug text-[color:var(--color-text-2)]">
                              {c.title}
                            </li>
                          ))}
                          {items.length > 4 && (
                            <li className="text-[11px] text-[color:var(--color-text-3)]">
                              +{items.length - 4} more
                            </li>
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
