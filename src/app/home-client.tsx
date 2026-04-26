"use client";

import CompareToast from "@/components/compare/compare-toast";
import Footer from "@/components/footer";
import LayerToggles, { DEFAULT_LAYERS } from "@/components/map/layer-toggles";
import Panel from "@/components/panel/panel";
import AddressSearch from "@/components/search/address-search";
import { type AddressUrlState, decodeAddress, encodeAddress } from "@/lib/url";
import type { Address, Horizon } from "@/types/concern";
import type { Route } from "next";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useState } from "react";

const MapView = dynamic(() => import("@/components/map/map"), { ssr: false });

const SAVED_KEY = "theami:compare";

export default function HomeClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [address, setAddress] = useState<Address | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<Horizon>(10);

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

  const handleSelect = useCallback(async (place: { place_id: string; description: string }) => {
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
      alert("We couldn't locate that address. Try a more specific SF address.");
    }
  }, []);

  const handleClose = useCallback(() => {
    posthog.capture("address_cleared");
    setAddress(null);
    setDescription(null);
    router.replace("/" as Route, { scroll: false });
  }, [router]);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      posthog.capture("share_clicked", { description });
      // tiny inline UX — using alert for now to avoid pulling toast deps
      // (replace with a toast later)
      const el = document.createElement("div");
      el.textContent = "Link copied";
      el.style.cssText =
        "position:fixed;left:50%;top:24px;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:white;padding:6px 12px;border-radius:999px;font-size:12px;z-index:9999;";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    } catch {
      /* ignore */
    }
  }, [description]);

  const handleSaveCompare = useCallback(() => {
    if (!address) return;
    if (isCurrentSaved) {
      posthog.capture("address_removed_from_compare", { description });
      persistSaved(
        saved.filter((s) => !(Math.abs(s.lat - address.lat) < 1e-4 && Math.abs(s.lng - address.lng) < 1e-4)),
      );
    } else {
      posthog.capture("address_saved_to_compare", { description, compare_count: saved.length + 1 });
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
    }
  }, [address, description, horizon, isCurrentSaved, persistSaved, saved]);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[color:var(--color-bg)]">
      <MapView
        pin={address ? { lat: address.lat, lng: address.lng } : null}
        flyTo={address ? { lat: address.lat, lng: address.lng, zoom: 16 } : null}
        visibleLayers={visibleLayers}
      />

      {/* Hero search (when no address selected) */}
      {!address && (
        <>
          {/* Subtle vignette to anchor the hero text against the map */}
          <div
            aria-hidden
            className="no-print pointer-events-none absolute inset-x-0 top-0 h-[80vh] z-[5]"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 30%, rgba(255,255,255,0.85), rgba(255,255,255,0.0) 70%)",
            }}
          />
          <div className="no-print pointer-events-none absolute inset-x-0 top-[20vh] z-10 flex flex-col items-center px-4">
            <div className="pointer-events-auto mb-6 text-center">
              <h1
                className="font-display text-[44px] leading-none tracking-tight sm:text-[56px]"
                style={{ textShadow: "0 1px 2px rgba(255,255,255,0.6)" }}
              >
                Theami
              </h1>
              <p className="mt-2 text-sm text-[color:var(--color-text-2)] sm:text-base">
                What to look out for at any San Francisco address.
              </p>
            </div>
            <div className="pointer-events-auto w-full max-w-xl">
              <AddressSearch onSelect={handleSelect} />
            </div>
            <p className="pointer-events-auto mt-3 text-xs text-[color:var(--color-text-3)]">
              Try “Duboce Triangle” or “321 Church St”. Press{" "}
              <kbd className="mx-1 rounded bg-black/5 px-1">/</kbd> to focus.
            </p>
          </div>
        </>
      )}

      {/* Persistent search chip top-left when an address is selected */}
      {address && (
        <div className="no-print pointer-events-auto absolute top-4 left-4 z-30">
          <AddressSearch
            value={description ?? `${address.lat.toFixed(4)}, ${address.lng.toFixed(4)}`}
            onSelect={handleSelect}
            onClear={handleClose}
          />
        </div>
      )}

      {/* Bottom-right layer toggles */}
      <div className="no-print absolute right-4 bottom-16 z-20">
        <LayerToggles
          visible={visibleLayers}
          onChange={(id, on) => setVisibleLayers((v) => ({ ...v, [id]: on }))}
        />
      </div>

      {/* Right panel */}
      {address && (
        <Panel
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

      <CompareToast saved={saved} onClear={() => persistSaved([])} />

      <Footer />
    </main>
  );
}
