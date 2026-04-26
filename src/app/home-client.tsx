"use client";

import AuthButton from "@/components/auth/auth-button";
import Wordmark from "@/components/brand/wordmark";
import CompareToast from "@/components/compare/compare-toast";
import Footer from "@/components/footer";
import QuickPicks, { type QuickPick } from "@/components/hero/quick-picks";
import LayerToggles, { DEFAULT_LAYERS } from "@/components/map/layer-toggles";
import Panel from "@/components/panel/panel";
import SavedHomesDock from "@/components/saved/saved-homes-dock";
import AddressSearch from "@/components/search/address-search";
import ShortcutsOverlay from "@/components/ui/shortcuts-overlay";
import { ToastHost, useToast } from "@/components/ui/toast";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { type AddressUrlState, decodeAddress, encodeAddress } from "@/lib/url";
import type { Address, Horizon } from "@/types/concern";
import type { Session } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import type { Route } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useState } from "react";

const MapView = dynamic(() => import("@/components/map/map"), { ssr: false });

const SAVED_KEY = "theami:compare";

const supabaseEnabled = isSupabaseConfigured();

export default function HomeClient() {
  return (
    <ToastHost>
      <HomeInner />
    </ToastHost>
  );
}

function HomeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();

  const [address, setAddress] = useState<Address | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<Horizon>(10);
  const [session, setSession] = useState<Session | null>(null);

  const initialUrlState = useMemo<AddressUrlState | null>(
    () => decodeAddress(new URLSearchParams(sp.toString())),
    [sp],
  );

  // Re-hydrate state from URL on mount.
  useEffect(() => {
    if (initialUrlState) {
      setAddress({ lat: initialUrlState.lat, lng: initialUrlState.lng });
      setHorizon(initialUrlState.horizon);
      setDescription(initialUrlState.label ?? null);
    }
  }, [initialUrlState]);

  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEFAULT_LAYERS.map((l) => [l.id, true])),
  );

  const heroOpen = !address;

  // While the hero is open the map is a quiet basemap — overlays only appear
  // once a user picks an address. We preserve their toggle state for later.
  const effectiveLayers = useMemo(() => {
    if (heroOpen) return Object.fromEntries(DEFAULT_LAYERS.map((l) => [l.id, false]));
    return visibleLayers;
  }, [heroOpen, visibleLayers]);

  // Track viewport width so the map can pad around the right panel correctly.
  const [vw, setVw] = useState<number>(typeof window === "undefined" ? 1280 : window.innerWidth);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const panelWidth = Math.min(460, vw);
  const panelOpen = !heroOpen;
  // Keep selected pins out from under the panel without making the whole map
  // feel cropped. A partial offset preserves west-side context while browsing.
  const mapPadding = panelOpen && vw >= 760 ? { right: Math.round(panelWidth * 0.58) } : undefined;

  // Saved addresses for compare (localStorage)
  const [saved, setSaved] = useState<AddressUrlState[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSaved(JSON.parse(raw) as AddressUrlState[]);
    } catch {
      /* ignore */
    }
  }, []);
  const persistSaved = useCallback((next: AddressUrlState[]) => {
    setSaved(next);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const isCurrentSaved = useMemo(
    () =>
      address
        ? saved.some((s) => Math.abs(s.lat - address.lat) < 1e-4 && Math.abs(s.lng - address.lng) < 1e-4)
        : false,
    [saved, address],
  );

  // Sync URL when address/horizon change
  useEffect(() => {
    if (!address) return;
    const params = encodeAddress({
      lat: address.lat,
      lng: address.lng,
      horizon,
      label: description ?? undefined,
    });
    const newUrl = `/?${params.toString()}` as Route;
    router.replace(newUrl, { scroll: false });
  }, [address?.lat, address?.lng, horizon, description, router, address]);

  const handleClose = useCallback(() => {
    posthog.capture("address_cleared");
    setAddress(null);
    setDescription(null);
    router.replace("/" as Route, { scroll: false });
  }, [router]);

  // Layer keyboard shortcuts: 1..8
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const idx = Number.parseInt(e.key, 10);
      if (Number.isFinite(idx) && idx >= 1 && idx <= DEFAULT_LAYERS.length) {
        const layer = DEFAULT_LAYERS[idx - 1];
        if (layer) {
          setVisibleLayers((v) => ({ ...v, [layer.id]: !(v[layer.id] ?? true) }));
        }
      } else if (e.key === "Escape") {
        if (address) handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleSelect = useCallback(
    async (place: { place_id: string; description: string }) => {
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ place_id: place.place_id }),
        });
        if (!res.ok) throw new Error(`geocode ${res.status}`);
        const a = (await res.json()) as Address;
        setAddress(a);
        setDescription(place.description);
      } catch (err) {
        console.error("[home] geocode failed:", err);
        toast.push("error", "Couldn't locate that address. Try a more specific SF address.");
      }
    },
    [toast],
  );

  const handleQuickPick = useCallback(
    async (q: QuickPick) => {
      try {
        // Use the suggest API to resolve the canonical place.
        const res = await fetch(`/api/places/suggest?q=${encodeURIComponent(q.query)}`);
        const data = (await res.json()) as { items: Array<{ place_id: string; description: string }> };
        const top = data.items[0];
        if (!top) {
          toast.push("error", "No matches for that neighborhood.");
          return;
        }
        await handleSelect(top);
      } catch (err) {
        console.error("[home] quick pick failed:", err);
        toast.push("error", "Couldn't open that neighborhood.");
      }
    },
    [handleSelect, toast],
  );

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      posthog.capture("share_clicked", { description });
      toast.push("success", "Permalink copied");
    } catch {
      toast.push("error", "Couldn't copy link");
    }
  }, [description, toast]);

  const handleSaveCompare = useCallback(() => {
    if (!address) return;
    if (isCurrentSaved) {
      posthog.capture("address_removed_from_compare", { description });
      persistSaved(
        saved.filter((s) => !(Math.abs(s.lat - address.lat) < 1e-4 && Math.abs(s.lng - address.lng) < 1e-4)),
      );
      toast.push("info", "Removed from compare");
    } else {
      posthog.capture("address_saved_to_compare", {
        description,
        compare_count: saved.length + 1,
      });
      const next: AddressUrlState[] = [
        ...saved,
        {
          lat: address.lat,
          lng: address.lng,
          horizon,
          label: description ?? `${address.lat.toFixed(4)}, ${address.lng.toFixed(4)}`,
        },
      ].slice(-4);
      persistSaved(next);
      toast.push(
        "success",
        next.length >= 2 ? `Saved · ${next.length} ready to compare` : "Saved to compare",
      );
    }
  }, [address, description, horizon, isCurrentSaved, persistSaved, saved, toast]);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[color:var(--color-bg)]">
      <MapView
        pin={address ? { lat: address.lat, lng: address.lng } : null}
        flyTo={address ? { lat: address.lat, lng: address.lng, zoom: 15.55 } : null}
        visibleLayers={effectiveLayers}
        padding={mapPadding}
        idle={heroOpen}
      />

      {/* Top-left wordmark */}
      <div className="no-print pointer-events-auto absolute top-4 left-4 z-30">
        <AnimatePresence mode="wait">
          {heroOpen ? (
            <motion.div
              key="brand"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
            >
              <Link href={"/" as Route} aria-label="Theami home" className="block">
                <Wordmark size={20} />
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="chip"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
            >
              <AddressSearch
                value={description ?? `${address?.lat.toFixed(4)}, ${address?.lng.toFixed(4)}`}
                onSelect={handleSelect}
                onClear={handleClose}
                variant="chip"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard shortcuts (top right) */}
      {supabaseEnabled && (
        <div className="no-print fixed top-4 right-16 z-30">
          <AuthButton onSessionChange={setSession} />
        </div>
      )}
      <ShortcutsOverlay />

      {supabaseEnabled && (
        <SavedHomesDock
          session={session}
          currentAddress={address}
          currentLabel={description}
          horizon={horizon}
        />
      )}

      {/* Hero — when no address selected */}
      <AnimatePresence>
        {heroOpen && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}
            className="no-print pointer-events-none absolute inset-0 z-10"
          >
            {/* Light cream wash — enough contrast for the hero, but the map stays alive. */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-[70vh]"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(245,243,238,0.86) 0%, rgba(245,243,238,0.68) 42%, rgba(245,243,238,0.22) 78%, rgba(245,243,238,0) 100%)",
              }}
            />

            <div className="absolute inset-x-0 top-[24vh] flex flex-col items-center px-6">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="font-display pointer-events-auto text-center text-[56px] leading-[0.94] sm:text-[88px]"
                style={{ letterSpacing: "-0.035em" }}
              >
                Know your home
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-auto mt-10 w-full max-w-xl"
              >
                <AddressSearch onSelect={handleSelect} variant="hero" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="pointer-events-auto mt-5"
              >
                <QuickPicks onPick={handleQuickPick} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom-right layer toggles */}
      <div className="no-print absolute right-4 bottom-16 z-20">
        <LayerToggles
          visible={visibleLayers}
          onChange={(id, on) => setVisibleLayers((v) => ({ ...v, [id]: on }))}
          onChangeAll={(next) => setVisibleLayers(next)}
        />
      </div>

      {/* Right panel */}
      <AnimatePresence>
        {address && (
          <Panel
            key="panel"
            address={address}
            description={description}
            horizon={horizon}
            onHorizonChange={setHorizon}
            onClose={handleClose}
            onShare={handleShare}
            onSaveCompare={handleSaveCompare}
            saved={isCurrentSaved}
          />
        )}
      </AnimatePresence>

      <CompareToast saved={saved} onClear={() => persistSaved([])} />

      <Footer compact />
    </main>
  );
}
