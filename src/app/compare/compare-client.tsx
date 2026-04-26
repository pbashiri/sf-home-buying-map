"use client";

import { compareParse } from "@/lib/url";
import type { Concern, ConcernsResponse, Horizon, Severity } from "@/types/concern";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useMemo, useState } from "react";

type Cell = {
  address: { lat: number; lng: number; label?: string };
  data?: ConcernsResponse;
  loading: boolean;
};

const SEVERITIES: Severity[] = ["alert", "watch", "favor", "context"];

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
            next[i] = { ...next[i]!, data, loading: false };
            return next;
          });
        })
        .catch((err) => {
          console.error("[compare]", err);
          setCells((prev) => {
            const next = [...prev];
            next[i] = { ...next[i]!, loading: false };
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
      {cells.map((cell, i) => (
        <article key={i} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <header>
            <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-3)]">
              {cell.data?.address.neighborhood ?? "SF"}
            </p>
            <h2 className="font-display mt-1 text-lg leading-tight">
              {cell.address.label ?? `${cell.address.lat.toFixed(4)}, ${cell.address.lng.toFixed(4)}`}
            </h2>
          </header>
          {cell.loading && (
            <div className="mt-4 space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-black/5" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-black/5" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-black/5" />
            </div>
          )}
          {cell.data && (
            <div className="mt-3 space-y-3">
              {SEVERITIES.map((sev) => {
                const items = cell.data!.concerns.filter((c) => c.severity === sev);
                if (items.length === 0) return null;
                return (
                  <div key={sev}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-3)]">
                      <span className={`dot dot-${sev}`} aria-hidden /> {sev} ({items.length})
                    </p>
                    <ul className="mt-1 space-y-1">
                      {items.slice(0, 4).map((c: Concern) => (
                        <li key={c.id} className="text-xs leading-snug">
                          {c.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
