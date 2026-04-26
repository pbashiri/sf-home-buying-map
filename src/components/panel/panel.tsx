"use client";

import { cn } from "@/lib/cn";
import type {
  Address,
  Concern,
  ConcernsResponse,
  Horizon,
  Severity,
  Summary,
  SummaryBullet,
} from "@/types/concern";
import * as Tabs from "@radix-ui/react-tabs";
import { AnimatePresence, motion } from "framer-motion";
import { BookmarkCheck, BookmarkPlus, ExternalLink, Loader2, Printer, Share2, X } from "lucide-react";
import posthog from "posthog-js";
import { useEffect, useMemo, useState } from "react";
import HorizonSelector from "./horizon-selector";
import SeverityBar from "./severity-bar";
import VerdictGauge from "./verdict-gauge";

type Props = {
  address: Address | null;
  description?: string | null;
  horizon: Horizon;
  onHorizonChange: (h: Horizon) => void;
  onClose: () => void;
  onShare: () => void;
  onSaveCompare?: () => void;
  saved?: boolean;
};

const SEVERITY_LABEL: Record<Severity, string> = {
  alert: "Alert",
  watch: "Watch",
  favor: "Favor",
  context: "Context",
};

export default function Panel({
  address,
  description,
  horizon,
  onHorizonChange,
  onClose,
  onShare,
  onSaveCompare,
  saved,
}: Props) {
  const [concernsResp, setConcernsResp] = useState<ConcernsResponse | null>(null);
  const [loadingConcerns, setLoadingConcerns] = useState(false);
  const [summary, setSummary] = useState<Partial<Summary> & { bullets: SummaryBullet[] }>({
    bullets: [],
  });
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"brief" | "concerns" | "sources">("brief");

  // Fetch concerns on (address, horizon) change
  useEffect(() => {
    if (!address) {
      setConcernsResp(null);
      return;
    }
    const ctl = new AbortController();
    setLoadingConcerns(true);
    setError(null);
    fetch(`/api/concerns?lat=${address.lat}&lng=${address.lng}&horizon=${horizon}`, {
      signal: ctl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`concerns ${res.status}`);
        return (await res.json()) as ConcernsResponse;
      })
      .then((data) => setConcernsResp(data))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(`Concerns failed to load: ${(err as Error).message}`);
      })
      .finally(() => setLoadingConcerns(false));
    return () => ctl.abort();
  }, [address?.lat, address?.lng, horizon, address]);

  // Stream summary when concerns arrive
  useEffect(() => {
    if (!concernsResp || !address) return;
    const ctl = new AbortController();
    setSummary({ bullets: [] });
    setLoadingSummary(true);
    (async () => {
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          signal: ctl.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            address: concernsResp.address,
            horizon,
            concerns: concernsResp.concerns,
            concerns_hash: concernsResp.concerns_hash,
          }),
        });
        if (!res.ok || !res.body) throw new Error(`summary ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        const next: Partial<Summary> & { bullets: SummaryBullet[] } = { bullets: [] };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split("\n\n");
          buf = events.pop() ?? "";
          for (const ev of events) {
            const m = ev.match(/^data: (.+)$/);
            if (!m || !m[1]) continue;
            if (m[1] === "[DONE]") continue;
            try {
              const parsed = JSON.parse(m[1]) as { type: string; value: unknown };
              if (parsed.type === "headline") next.headline = parsed.value as string;
              else if (parsed.type === "bullet") next.bullets.push(parsed.value as SummaryBullet);
              else if (parsed.type === "outlook") next.outlook = parsed.value as string;
              else if (parsed.type === "verdict") next.verdict = parsed.value as Summary["verdict"];
              else if (parsed.type === "error") throw new Error(parsed.value as string);
              setSummary({ ...next, bullets: [...next.bullets] });
            } catch (e) {
              console.warn("[panel] parse error:", e);
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        setError(`Summary failed: ${(err as Error).message}`);
      } finally {
        setLoadingSummary(false);
      }
    })();
    return () => ctl.abort();
  }, [concernsResp, address, horizon]);

  const concernsById = useMemo(() => {
    const m = new Map<string, Concern>();
    if (concernsResp) for (const c of concernsResp.concerns) m.set(c.id, c);
    return m;
  }, [concernsResp]);

  const counts = useMemo<Record<Severity, number>>(() => {
    const init: Record<Severity, number> = { alert: 0, watch: 0, favor: 0, context: 0 };
    if (!concernsResp) return init;
    for (const c of concernsResp.concerns) init[c.severity]++;
    return init;
  }, [concernsResp]);

  if (!address) return null;

  const grouped = concernsResp
    ? (["alert", "watch", "favor", "context"] as Severity[]).map((sev) => ({
        sev,
        items: concernsResp.concerns.filter((c) => c.severity === sev),
      }))
    : [];

  const totalConcerns = concernsResp?.concerns.length ?? 0;
  const sources = concernsResp
    ? Array.from(
        new Map(
          concernsResp.concerns.map((c) => [
            c.source.url,
            { ...c.source, ingested_at: c.ingested_at, count: 0 },
          ]),
        ).values(),
      ).map((s) => ({
        ...s,
        count: concernsResp.concerns.filter((c) => c.source.url === s.url).length,
      }))
    : [];

  return (
    <motion.aside
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="no-print fixed top-0 right-0 bottom-0 z-30 flex w-full max-w-[460px] flex-col overflow-hidden border-l border-black/10 bg-[color:var(--color-bg)] shadow-[-8px_0_40px_-12px_rgba(0,0,0,0.18)] print:relative print:w-full print:max-w-none print:border-0 print:shadow-none"
      aria-label="Concerns panel"
    >
      {/* ── Editorial header ─────────────────────────────────────── */}
      <header className="surface-glass relative flex flex-col gap-3 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-3)]">
              {address.neighborhood ?? "San Francisco"} · {totalConcerns} concerns
            </p>
            <h2 className="font-display mt-1 truncate text-[26px] leading-[1.1]">
              {description ?? `${address.lat.toFixed(4)}, ${address.lng.toFixed(4)}`}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="rounded-full p-1.5 text-[color:var(--color-text-3)] transition-colors hover:bg-black/5 hover:text-[color:var(--color-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <HorizonSelector value={horizon} onChange={onHorizonChange} />
          <div className="ml-auto flex items-center gap-1">
            {onSaveCompare && (
              <button
                type="button"
                onClick={onSaveCompare}
                aria-label={saved ? "Saved to compare" : "Save to compare"}
                title={saved ? "Saved to compare" : "Save to compare"}
                className={cn(
                  "rounded-full p-2 transition-colors",
                  saved
                    ? "bg-[color:var(--color-ink)] text-white"
                    : "text-[color:var(--color-text-3)] hover:bg-black/5 hover:text-[color:var(--color-ink)]",
                )}
              >
                {saved ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onShare}
              aria-label="Share permalink"
              title="Share permalink"
              className="rounded-full p-2 text-[color:var(--color-text-3)] transition-colors hover:bg-black/5 hover:text-[color:var(--color-ink)]"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Print"
              title="Print"
              className="rounded-full p-2 text-[color:var(--color-text-3)] transition-colors hover:bg-black/5 hover:text-[color:var(--color-ink)]"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────── */}
        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <Tabs.List className="relative -mx-1 flex items-center gap-1 px-1">
            {(["brief", "concerns", "sources"] as const).map((id) => (
              <Tabs.Trigger
                key={id}
                value={id}
                className="relative rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-3)] transition-colors data-[state=active]:text-[color:var(--color-ink)]"
              >
                {tab === id && (
                  <motion.span
                    layoutId="panel-tab-bg"
                    className="absolute inset-0 -z-10 rounded-full bg-black/[0.06]"
                    transition={{ type: "spring", duration: 0.32, bounce: 0.18 }}
                  />
                )}
                {id}
                {id === "concerns" && totalConcerns > 0 && (
                  <span className="font-mono tabular ml-1 text-[10px] text-[color:var(--color-text-3)]">
                    {totalConcerns}
                  </span>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
      </header>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="scroll-fancy flex-1 overflow-y-auto">
        {/* Brief */}
        {tab === "brief" && (
          <div className="space-y-5 px-5 py-5">
            <VerdictGauge verdict={summary.verdict} loading={loadingSummary && !summary.verdict} />

            <SummarySection summary={summary} loading={loadingSummary} concernsById={concernsById} />

            {error && (
              <p className="rounded-lg border border-[color:var(--color-alert)]/20 bg-[color:var(--color-alert)]/[0.06] px-3 py-2 text-sm text-[color:var(--color-alert)]">
                {error}
              </p>
            )}

            {!loadingConcerns && concernsResp && totalConcerns > 0 && (
              <section aria-labelledby="distribution">
                <h3
                  id="distribution"
                  className="font-mono mb-2 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-3)]"
                >
                  Distribution
                </h3>
                <SeverityBar counts={counts} />
              </section>
            )}
          </div>
        )}

        {/* Concerns */}
        {tab === "concerns" && (
          <div className="space-y-5 px-5 py-5">
            {loadingConcerns && (
              <div className="flex items-center gap-2 text-sm text-[color:var(--color-text-3)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading authoritative datasets…
              </div>
            )}
            {grouped.map(({ sev, items }) =>
              items.length === 0 ? null : (
                <section key={sev} aria-labelledby={`group-${sev}`}>
                  <h4
                    id={`group-${sev}`}
                    className="font-mono mb-2 flex items-center text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-3)]"
                  >
                    <span className={`dot dot-${sev}`} aria-hidden />
                    <span className="text-[color:var(--color-text-2)]">{SEVERITY_LABEL[sev]}</span>
                    <span className="tabular ml-1">({items.length})</span>
                  </h4>
                  <ol className="space-y-2">
                    {items.map((c, idx) => (
                      <ConcernCard key={c.id} concern={c} index={idx} />
                    ))}
                  </ol>
                </section>
              ),
            )}
            {!loadingConcerns && totalConcerns === 0 && (
              <p className="text-sm text-[color:var(--color-text-3)]">
                No concerns surfaced at this address. That's not nothing — it usually means the authoritative
                datasets we pull don't flag this block.
              </p>
            )}
          </div>
        )}

        {/* Sources */}
        {tab === "sources" && (
          <div className="space-y-3 px-5 py-5">
            <p className="text-sm leading-relaxed text-[color:var(--color-text-2)]">
              Every claim above resolves back to a primary dataset. Hover or click to inspect.
            </p>
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.url} className="surface-elevated flex items-start gap-3 rounded-xl p-3">
                  <div className="font-mono mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-[10px] tabular text-[color:var(--color-text-2)]">
                    {s.count}
                  </div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-ink)] underline-offset-2 hover:underline"
                    >
                      {s.label}
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                    <p className="font-mono tabular mt-0.5 text-[11px] text-[color:var(--color-text-3)]">
                      updated{" "}
                      {new Date(s.ingested_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="px-5 pt-2 pb-5 text-[11px] leading-relaxed text-[color:var(--color-text-3)]">
          For informational purposes only. Verify with licensed professionals before any purchase decision.
        </p>
      </div>
    </motion.aside>
  );
}

function SummarySection({
  summary,
  loading,
  concernsById,
}: {
  summary: Partial<Summary> & { bullets: SummaryBullet[] };
  loading: boolean;
  concernsById: Map<string, Concern>;
}) {
  const isStreaming = loading;

  if (loading && !summary.headline) {
    return <SummarySkeleton />;
  }

  return (
    <section aria-label="Summary">
      {summary.headline && (
        <h3
          className={cn(
            "font-display text-[22px] leading-snug",
            isStreaming && !summary.outlook && "streaming-cursor",
          )}
        >
          {summary.headline}
        </h3>
      )}

      {summary.bullets.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          <AnimatePresence initial={false}>
            {summary.bullets.map((b, i) => {
              if (!concernsById.has(b.concern_id)) return null;
              return (
                <motion.li
                  key={`${b.concern_id}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-2.5 text-sm leading-relaxed"
                >
                  <span className={`dot dot-${b.severity} mt-1.5`} aria-hidden />
                  <span>{b.text}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {summary.outlook && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.06 }}
          className="font-display mt-5 border-t border-black/[0.07] pt-4 text-[15px] italic leading-relaxed text-[color:var(--color-text-2)]"
        >
          {summary.outlook}
        </motion.p>
      )}
    </section>
  );
}

function ConcernCard({ concern, index }: { concern: Concern; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.18) }}
      className={cn(
        "rounded-xl border-l-[3px] border-y border-r border-black/[0.06] bg-white/70 p-3.5 transition-colors hover:bg-white print:bg-white",
        `bd-${concern.severity}`,
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className={`dot dot-${concern.severity}`} aria-hidden />
        <h5 className="text-sm font-semibold leading-snug text-[color:var(--color-ink)]">{concern.title}</h5>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-text-2)]">{concern.body}</p>
      {concern.action && (
        <p className="mt-2 border-t border-black/[0.05] pt-2 text-xs italic text-[color:var(--color-text-2)]">
          → {concern.action}
        </p>
      )}
      <div className="font-mono mt-2.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[color:var(--color-text-3)]">
        <a
          href={concern.source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-[color:var(--color-text-2)] underline-offset-2 hover:underline"
          onClick={() =>
            posthog.capture("concern_source_clicked", {
              concern_id: concern.id,
              concern_title: concern.title,
              severity: concern.severity,
              source_label: concern.source.label,
            })
          }
        >
          {concern.source.label}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        <span aria-hidden>·</span>
        <time className="tabular" dateTime={concern.ingested_at} title={concern.ingested_at}>
          {new Date(concern.ingested_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </div>
    </motion.li>
  );
}

function SummarySkeleton() {
  return (
    <div aria-busy className="space-y-3">
      <div className="h-6 w-3/4 animate-pulse rounded bg-black/[0.06]" />
      <div className="h-3 w-full animate-pulse rounded bg-black/[0.05]" />
      <div className="h-3 w-11/12 animate-pulse rounded bg-black/[0.05]" />
      <div className="h-3 w-9/12 animate-pulse rounded bg-black/[0.05]" />
    </div>
  );
}
