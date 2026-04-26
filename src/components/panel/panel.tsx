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
import { ExternalLink, Loader2, Printer, Share2, X } from "lucide-react";
import posthog from "posthog-js";
import { useEffect, useMemo, useState } from "react";
import HorizonSelector from "./horizon-selector";

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

  // Map of concern id → concern for bullet lookup
  const concernsById = useMemo(() => {
    const m = new Map<string, Concern>();
    if (concernsResp) for (const c of concernsResp.concerns) m.set(c.id, c);
    return m;
  }, [concernsResp]);

  if (!address) return null;

  const grouped = concernsResp
    ? (["alert", "watch", "favor", "context"] as Severity[]).map((sev) => ({
        sev,
        items: concernsResp.concerns.filter((c) => c.severity === sev),
      }))
    : [];

  return (
    <aside
      className="no-print fixed top-0 right-0 bottom-0 z-30 flex w-full max-w-[440px] flex-col overflow-hidden border-l border-black/10 bg-[color:var(--color-bg)] shadow-2xl print:relative print:w-full print:max-w-none print:border-0 print:shadow-none"
      style={{
        animation: "slide-in 320ms var(--ease-entrance)",
      }}
      aria-label="Concerns panel"
    >
      <header className="surface-glass relative flex flex-col gap-3 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-3)]">
              {address.neighborhood ?? "San Francisco"}
            </p>
            <h2 className="font-display mt-0.5 truncate text-2xl leading-tight">
              {description ?? `${address.lat.toFixed(4)}, ${address.lng.toFixed(4)}`}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <HorizonSelector value={horizon} onChange={onHorizonChange} />
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onShare}
              aria-label="Share permalink"
              title="Share permalink"
              className="rounded-full p-2 hover:bg-black/5"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Print"
              title="Print"
              className="rounded-full p-2 hover:bg-black/5"
            >
              <Printer className="h-4 w-4" />
            </button>
            {onSaveCompare && (
              <button
                type="button"
                onClick={onSaveCompare}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  saved ? "bg-[color:var(--color-ink)] text-white" : "bg-black/5 hover:bg-black/10",
                )}
              >
                {saved ? "Saved" : "Save to compare"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Summary */}
        <section aria-label="Summary">
          {loadingSummary && !summary.headline ? (
            <SummarySkeleton />
          ) : (
            <>
              {summary.headline && (
                <h3 className="font-display mb-3 text-xl leading-snug">{summary.headline}</h3>
              )}
              {summary.bullets.length > 0 && (
                <ul className="space-y-2">
                  {summary.bullets.map((b, i) => {
                    if (!concernsById.has(b.concern_id)) return null; // drop hallucinations
                    return (
                      <li
                        key={`${b.concern_id}-${i}`}
                        className="flex items-start gap-2 text-sm leading-relaxed"
                      >
                        <span className={`dot dot-${b.severity} mt-1.5`} aria-hidden />
                        <span>{b.text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {summary.outlook && (
                <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-text-2)]">
                  {summary.outlook}
                </p>
              )}
              {summary.verdict && (
                <p className="mt-3">
                  <span
                    className={cn(
                      "tabular inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      summary.verdict === "alert" &&
                        "bg-[color:var(--color-alert)]/10 text-[color:var(--color-alert)]",
                      summary.verdict === "watch" &&
                        "bg-[color:var(--color-watch)]/10 text-[color:var(--color-watch)]",
                      summary.verdict === "favor" &&
                        "bg-[color:var(--color-favor)]/10 text-[color:var(--color-favor)]",
                      summary.verdict === "neutral" && "bg-black/5 text-[color:var(--color-text-2)]",
                    )}
                  >
                    Verdict: {summary.verdict}
                  </span>
                </p>
              )}
            </>
          )}
        </section>

        {/* Concerns */}
        {loadingConcerns && (
          <div className="flex items-center gap-2 text-sm text-[color:var(--color-text-3)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading authoritative datasets…
          </div>
        )}
        {error && <p className="text-sm text-[color:var(--color-alert)]">{error}</p>}
        {grouped.map(({ sev, items }) =>
          items.length === 0 ? null : (
            <section key={sev} aria-labelledby={`group-${sev}`}>
              <h4
                id={`group-${sev}`}
                className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-3)]"
              >
                <span className={`dot dot-${sev}`} aria-hidden />
                {SEVERITY_LABEL[sev]} <span className="tabular ml-1 font-normal">({items.length})</span>
              </h4>
              <ol className="space-y-2">
                {items.map((c) => (
                  <ConcernCard key={c.id} concern={c} />
                ))}
              </ol>
            </section>
          ),
        )}
        <p className="pt-4 text-[11px] leading-relaxed text-[color:var(--color-text-3)]">
          For informational purposes only. Verify with licensed professionals before any purchase decision.
          Source dates show how fresh each layer is.
        </p>
      </div>

      <style>
        {"@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }"}
      </style>
    </aside>
  );
}

function ConcernCard({ concern }: { concern: Concern }) {
  return (
    <li
      className={cn(
        "rounded-xl border-l-4 border-y border-r border-black/5 bg-white/60 p-3 print:bg-white",
        `bd-${concern.severity}`,
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className={`dot dot-${concern.severity}`} aria-hidden />
        <h5 className="text-sm font-semibold leading-snug">{concern.title}</h5>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-2)]">{concern.body}</p>
      {concern.action && (
        <p className="mt-1.5 text-xs italic text-[color:var(--color-text-2)]">→ {concern.action}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--color-text-3)]">
        <a
          href={concern.source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
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
          updated{" "}
          {new Date(concern.ingested_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </div>
    </li>
  );
}

function SummarySkeleton() {
  return (
    <div aria-busy className="space-y-3">
      <div className="h-6 w-3/4 animate-pulse rounded bg-black/5" />
      <div className="h-3 w-full animate-pulse rounded bg-black/5" />
      <div className="h-3 w-11/12 animate-pulse rounded bg-black/5" />
      <div className="h-3 w-9/12 animate-pulse rounded bg-black/5" />
    </div>
  );
}
