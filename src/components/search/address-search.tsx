"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, Loader2, MapPin, Search, X } from "lucide-react";
import posthog from "posthog-js";
import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { place_id: string; description: string; source: string };

type Props = {
  value?: string | null;
  onSelect: (place: { place_id: string; description: string }) => void;
  onClear?: () => void;
  /** Larger / softer presentation for the hero. */
  variant?: "hero" | "chip";
};

const RECENTS_KEY = "theami:recents";
const MAX_RECENTS = 6;

type Recent = { place_id: string; description: string; ts: number };

function readRecents(): Recent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as Recent[];
    return items.slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function pushRecent(item: { place_id: string; description: string }) {
  if (typeof window === "undefined") return;
  try {
    const existing = readRecents();
    const next = [{ ...item, ts: Date.now() }, ...existing.filter((r) => r.place_id !== item.place_id)].slice(
      0,
      MAX_RECENTS,
    );
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export default function AddressSearch({ value, onSelect, onClear, variant = "hero" }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Global "/" focus shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setRecents(readRecents());
  }, []);

  // Debounced suggestion fetch
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(query)}`);
        const data = (await res.json()) as { items: Suggestion[] };
        setSuggestions(data.items.slice(0, 8));
        setHighlight(0);
      } catch (err) {
        console.error("[search] suggest failed:", err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  function commit(item: { place_id: string; description: string; source?: string }): void {
    posthog.capture("address_selected", {
      description: item.description,
      source: item.source ?? "recent",
    });
    pushRecent({ place_id: item.place_id, description: item.description });
    onSelect({ place_id: item.place_id, description: item.description });
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    const list: Array<{ place_id: string; description: string; source?: string }> =
      query.trim().length >= 2 ? suggestions : recents;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const item = list[highlight];
      if (item) commit(item);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  // Chip mode: post-selection persistent breadcrumb.
  if (value) {
    return (
      <motion.div
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="surface-glass flex max-w-[340px] items-center gap-2 rounded-full px-3.5 py-2 text-sm shadow-md"
      >
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]"
        >
          <MapPin className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <span className="truncate font-medium" title={value}>
          {value}
        </span>
        {onClear && (
          <button
            type="button"
            aria-label="Clear address"
            onClick={onClear}
            className="ml-auto rounded-full p-1 text-[color:var(--color-text-3)] transition-colors hover:bg-black/5 hover:text-[color:var(--color-ink)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </motion.div>
    );
  }

  const showRecents = query.trim().length < 2 && recents.length > 0;
  const showSuggestions = query.trim().length >= 2 && suggestions.length > 0;
  const isHero = variant === "hero";

  return (
    <div className="relative w-full max-w-xl">
      <div
        className={`surface-glass flex items-center gap-3 rounded-full ${
          isHero ? "px-5 py-4" : "px-4 py-3"
        } shadow-lg transition-shadow focus-within:shadow-xl`}
      >
        <Search
          className={`h-4 w-4 text-[color:var(--color-text-3)] ${isHero ? "h-5 w-5" : ""}`}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck="false"
          placeholder="Search any San Francisco address or neighborhood…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          onKeyDown={onKey}
          className={`flex-1 bg-transparent outline-none placeholder:text-[color:var(--color-text-3)] ${
            isHero ? "text-base sm:text-lg" : "text-base"
          }`}
          aria-autocomplete="list"
          aria-expanded={open && (showSuggestions || showRecents)}
          aria-controls={listId}
        />
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-text-3)]" aria-hidden />
        ) : (
          <kbd className="font-mono hidden h-6 items-center rounded-md border border-black/10 bg-black/[0.04] px-1.5 text-[11px] tabular text-[color:var(--color-text-3)] sm:inline-flex">
            /
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {open && (showSuggestions || showRecents) && (
          <motion.ul
            id={listId}
            initial={{ y: -4, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -2, opacity: 0, scale: 0.995 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="surface-glass absolute z-20 mt-2 w-full overflow-hidden rounded-2xl py-1.5 shadow-xl"
          >
            {showRecents && (
              <>
                <li className="px-4 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-3)]">
                  Recent
                </li>
                {recents.map((s, i) => (
                  <li key={s.place_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlight}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commit(s);
                      }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
                        i === highlight ? "bg-black/5" : "hover:bg-black/[0.03]"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 text-[color:var(--color-text-3)]" aria-hidden />
                      <span className="truncate">{s.description}</span>
                    </button>
                  </li>
                ))}
              </>
            )}
            {showSuggestions &&
              suggestions.map((s, i) => (
                <li key={s.place_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(s);
                    }}
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
                      i === highlight ? "bg-black/5" : "hover:bg-black/[0.03]"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5 text-[color:var(--color-text-3)]" aria-hidden />
                    <span className="truncate">{s.description}</span>
                    {s.source !== "google" && (
                      <span className="font-mono ml-auto rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[color:var(--color-text-3)]">
                        {s.source}
                      </span>
                    )}
                  </button>
                </li>
              ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {loading && open && suggestions.length === 0 && query.trim().length >= 2 && (
        <div className="surface-glass absolute z-20 mt-2 w-full rounded-2xl px-4 py-3 text-sm text-[color:var(--color-text-3)]">
          Searching…
        </div>
      )}
    </div>
  );
}
