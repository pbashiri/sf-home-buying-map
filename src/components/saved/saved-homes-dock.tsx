"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { type AddressUrlState, compareSerialise } from "@/lib/url";
import type { Address, Horizon } from "@/types/concern";
import type { SavedHome, SavedHomeMessage } from "@/types/saved-home";
import type { Session } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Copy, Home, Loader2, MessageCircle, Plus, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  session: Session | null;
  currentAddress: Address | null;
  currentLabel: string | null;
  horizon: Horizon;
};

export default function SavedHomesDock({ session, currentAddress, currentLabel, horizon }: Props) {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(() => (configured ? createSupabaseBrowserClient() : null), [configured]);
  const [open, setOpen] = useState(false);
  const [homes, setHomes] = useState<SavedHome[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<SavedHomeMessage[]>([]);
  const selected = homes.find((h) => h.id === selectedId) ?? homes[0] ?? null;

  const loadHomes = useCallback(async () => {
    if (!supabase || !session) {
      setHomes([]);
      setSelectedId(null);
      return;
    }
    const { data, error } = await supabase
      .from("saved_homes")
      .select("id,label,lat,lng,horizon,notes,share_token,share_enabled,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[saved_homes] load failed", error);
      return;
    }
    const next = (data ?? []).map((h) => ({ ...h, lat: Number(h.lat), lng: Number(h.lng) })) as SavedHome[];
    setHomes(next);
    setSelectedId((id) => (id && next.some((h) => h.id === id) ? id : (next[0]?.id ?? null)));
  }, [session, supabase]);

  useEffect(() => {
    loadHomes();
  }, [loadHomes]);

  useEffect(() => {
    async function loadMessages() {
      if (!supabase || !session || !selected) {
        setMessages([]);
        return;
      }
      const { data, error } = await supabase
        .from("saved_home_messages")
        .select("id,saved_home_id,role,content,created_at")
        .eq("saved_home_id", selected.id)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[saved_home_messages] load failed", error);
        return;
      }
      setMessages((data ?? []) as SavedHomeMessage[]);
    }
    loadMessages();
  }, [selected, session, supabase]);

  async function saveCurrentHome() {
    if (!supabase || !session || !currentAddress) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("saved_homes")
      .upsert(
        {
          user_id: session.user.id,
          label:
            currentLabel ??
            currentAddress.formatted ??
            `${currentAddress.lat.toFixed(4)}, ${currentAddress.lng.toFixed(4)}`,
          lat: currentAddress.lat,
          lng: currentAddress.lng,
          horizon,
        },
        { onConflict: "user_id,lat,lng" },
      )
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      console.error("[saved_homes] save failed", error);
      return;
    }
    setOpen(true);
    setSelectedId(data.id as string);
    await loadHomes();
  }

  async function updateNotes(home: SavedHome, notes: string) {
    setHomes((prev) =>
      prev.map((h) => (h.id === home.id ? { ...h, notes, updated_at: new Date().toISOString() } : h)),
    );
    if (!supabase) return;
    const { error } = await supabase.from("saved_homes").update({ notes }).eq("id", home.id);
    if (error) console.error("[saved_homes] notes failed", error);
  }

  async function deleteHome(home: SavedHome) {
    if (!supabase) return;
    setHomes((prev) => prev.filter((h) => h.id !== home.id));
    await supabase.from("saved_homes").delete().eq("id", home.id);
  }

  async function copyShareLink(home: SavedHome) {
    if (!supabase) return;
    const token = home.share_token ?? crypto.randomUUID();
    const { error } = await supabase
      .from("saved_homes")
      .update({ share_token: token, share_enabled: true })
      .eq("id", home.id);
    if (error) {
      console.error("[saved_homes] share failed", error);
      return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
    await loadHomes();
  }

  async function sendChat() {
    if (!session || !selected || !chatInput.trim()) return;
    const content = chatInput.trim();
    setChatInput("");
    const optimistic: SavedHomeMessage = {
      id: crypto.randomUUID(),
      saved_home_id: selected.id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const res = await fetch("/api/saved-homes/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ saved_home_id: selected.id, message: content }),
    });
    const data = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        saved_home_id: selected.id,
        role: "assistant",
        content: data?.reply ?? data?.error ?? "I couldn't answer that yet.",
        created_at: new Date().toISOString(),
      },
    ]);
    await loadHomes();
  }

  const compareHref =
    homes.length >= 2
      ? (`/compare?addrs=${encodeURIComponent(
          compareSerialise(
            homes.slice(0, 4).map(
              (h): AddressUrlState => ({
                lat: h.lat,
                lng: h.lng,
                horizon: h.horizon as Horizon,
                label: h.label,
              }),
            ),
          ),
        )}` as Route)
      : ("/compare" as Route);

  return (
    <div className="no-print fixed top-16 left-4 z-30">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="surface-glass inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-md"
        >
          <Home className="h-3.5 w-3.5" aria-hidden />
          Saved homes
          {homes.length > 0 && (
            <span className="font-mono tabular text-[color:var(--color-text-3)]">{homes.length}</span>
          )}
        </button>
        {currentAddress && (
          <button
            type="button"
            disabled={!session || busy}
            onClick={saveCurrentHome}
            className="surface-glass inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            title={session ? "Save this home" : "Sign in to save homes"}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="surface-glass mt-2 grid max-h-[72vh] w-[360px] grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl shadow-xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Your homes</h2>
                <p className="text-xs text-[color:var(--color-text-3)]">Notes, compare, share, and chat.</p>
              </div>
              <Link
                href={compareHref}
                className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white"
              >
                Compare
              </Link>
            </header>

            <div className="scroll-fancy overflow-y-auto p-3">
              {!session && (
                <p className="rounded-xl bg-black/[0.04] p-3 text-sm text-[color:var(--color-text-2)]">
                  Sign in with Google or email to save houses and keep notes.
                </p>
              )}
              {session && homes.length === 0 && (
                <p className="rounded-xl bg-black/[0.04] p-3 text-sm text-[color:var(--color-text-2)]">
                  Pick or pin a property, then save it here.
                </p>
              )}
              <div className="space-y-2">
                {homes.map((home) => (
                  <article
                    key={home.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      selected?.id === home.id ? "border-black/20 bg-white/65" : "border-black/10 bg-white/35"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(home.id)}
                      className="block w-full text-left"
                    >
                      <h3 className="truncate text-sm font-semibold">{home.label}</h3>
                      <p className="font-mono mt-0.5 text-[10px] text-[color:var(--color-text-3)]">
                        {home.lat.toFixed(4)}, {home.lng.toFixed(4)} · {home.horizon} yr
                      </p>
                    </button>
                    <textarea
                      value={home.notes ?? ""}
                      onChange={(e) => updateNotes(home, e.target.value)}
                      placeholder="Private notes about this property..."
                      className="mt-2 min-h-16 w-full resize-none rounded-lg border border-black/10 bg-white/70 px-2.5 py-2 text-sm outline-none focus:border-black/30"
                    />
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyShareLink(home)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[color:var(--color-text-2)] hover:bg-black/5"
                      >
                        <Copy className="h-3.5 w-3.5" /> Share
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedId(home.id)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[color:var(--color-text-2)] hover:bg-black/5"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHome(home)}
                        className="ml-auto rounded-full p-1 text-[color:var(--color-text-3)] hover:bg-black/5 hover:text-[color:var(--color-alert)]"
                        aria-label={`Delete ${home.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <form
              className="border-t border-black/10 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <div className="mb-2 max-h-28 space-y-2 overflow-y-auto text-xs">
                {selected ? (
                  messages.slice(-4).map((m) => (
                    <p
                      key={m.id}
                      className={
                        m.role === "user"
                          ? "text-[color:var(--color-text)]"
                          : "text-[color:var(--color-text-2)]"
                      }
                    >
                      <span className="font-semibold">{m.role === "user" ? "You" : "Theami"}:</span>{" "}
                      {m.content}
                    </p>
                  ))
                ) : (
                  <p className="inline-flex items-center gap-1 text-[color:var(--color-text-3)]">
                    <Bot className="h-3.5 w-3.5" /> Save a home to ask questions about it.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={!selected || !session}
                  placeholder={selected ? `Ask about ${selected.label}` : "Ask about a saved home"}
                  className="min-w-0 flex-1 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:border-black/30 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!selected || !session || !chatInput.trim()}
                  className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Ask
                </button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
