"use client";

import { Search, X } from "lucide-react";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";

type Suggestion = { place_id: string; description: string; source: string };

type Props = {
  value?: string | null;
  onSelect: (place: { place_id: string; description: string }) => void;
  onClear?: () => void;
};

export default function AddressSearch({ value, onSelect, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  function commit(item: Suggestion): void {
    posthog.capture("address_selected", {
      description: item.description,
      source: item.source,
    });
    onSelect({ place_id: item.place_id, description: item.description });
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const item = suggestions[highlight];
      if (item) commit(item);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  // If a value is provided (post-selection), show it as a chip.
  if (value) {
    return (
      <div className="surface-glass flex max-w-xl items-center gap-2 rounded-full px-4 py-2 text-sm shadow-sm">
        <span aria-hidden className="text-base">
          📍
        </span>
        <span className="truncate font-medium" title={value}>
          {value}
        </span>
        {onClear && (
          <button
            type="button"
            aria-label="Clear address"
            onClick={onClear}
            className="ml-auto rounded-full p-1 hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-xl">
      <div className="surface-glass flex items-center gap-2 rounded-full px-4 py-3 shadow-sm">
        <Search className="h-4 w-4 text-[color:var(--color-text-3)]" aria-hidden />
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
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          className="flex-1 bg-transparent text-base outline-none placeholder:text-[color:var(--color-text-3)]"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="address-suggestions"
        />
        <kbd className="hidden rounded bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--color-text-3)] sm:inline-block">
          /
        </kbd>
      </div>
      {open && suggestions.length > 0 && (
        <ul
          id="address-suggestions"
          className="surface-glass absolute z-20 mt-2 w-full overflow-hidden rounded-xl py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
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
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                  i === highlight ? "bg-black/5" : ""
                }`}
              >
                <span className="text-base" aria-hidden>
                  📍
                </span>
                <span className="truncate">{s.description}</span>
                {s.source !== "google" && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-[color:var(--color-text-3)]">
                    {s.source}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && open && suggestions.length === 0 && (
        <div className="surface-glass absolute z-20 mt-2 w-full rounded-xl px-4 py-3 text-sm text-[color:var(--color-text-3)]">
          Searching…
        </div>
      )}
    </div>
  );
}
