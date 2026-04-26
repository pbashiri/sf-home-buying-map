"use client";

import * as Popover from "@radix-ui/react-popover";
import { motion } from "framer-motion";
import { Building2, CloudFog, GraduationCap, Layers, ShieldAlert, Train, Waves, Zap } from "lucide-react";
import posthog from "posthog-js";
import type { ComponentType, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type LayerToggle = {
  id: string;
  label: string;
  hue: string;
  category: "Hazards" | "Mobility" | "Quality of life";
  icon: Icon;
};

export const DEFAULT_LAYERS: LayerToggle[] = [
  {
    id: "seismic_liquefaction",
    label: "Liquefaction (CGS)",
    hue: "var(--color-seismic)",
    category: "Hazards",
    icon: Zap,
  },
  {
    id: "flood_fema",
    label: "Flood / SLR",
    hue: "var(--color-flood)",
    category: "Hazards",
    icon: Waves,
  },
  {
    id: "zoning_upzone",
    label: "Upzoning corridors",
    hue: "var(--color-upzone)",
    category: "Hazards",
    icon: Building2,
  },
  {
    id: "safety_hin",
    label: "High Injury Network",
    hue: "var(--color-safety)",
    category: "Hazards",
    icon: ShieldAlert,
  },
  {
    id: "schools",
    label: "Schools",
    hue: "var(--color-schools)",
    category: "Quality of life",
    icon: GraduationCap,
  },
  {
    id: "transit_bart",
    label: "BART",
    hue: "var(--color-transit)",
    category: "Mobility",
    icon: Train,
  },
  {
    id: "transit_muni_metro",
    label: "Muni Metro",
    hue: "var(--color-transit)",
    category: "Mobility",
    icon: Train,
  },
  {
    id: "climate_fog",
    label: "Fog belt",
    hue: "var(--color-fog)",
    category: "Quality of life",
    icon: CloudFog,
  },
];

const CATEGORIES: Array<LayerToggle["category"]> = ["Hazards", "Mobility", "Quality of life"];

type Props = {
  visible: Record<string, boolean>;
  onChange: (id: string, on: boolean) => void;
  onChangeAll?: (next: Record<string, boolean>) => void;
};

export default function LayerToggles({ visible, onChange, onChangeAll }: Props) {
  const enabledCount = DEFAULT_LAYERS.filter((l) => visible[l.id] ?? true).length;

  const setAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    for (const l of DEFAULT_LAYERS) next[l.id] = on;
    onChangeAll?.(next);
    posthog.capture("layers_set_all", { enabled: on });
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Map layers"
          title="Map layers"
          className="surface-glass tabular flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold shadow transition-shadow hover:shadow-lg"
        >
          <Layers className="h-4 w-4" aria-hidden />
          <span>Layers</span>
          <span className="font-mono rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] tabular text-[color:var(--color-text-2)]">
            {enabledCount}/{DEFAULT_LAYERS.length}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" side="top" sideOffset={8} asChild>
          <motion.div
            initial={{ y: 4, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 4, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="surface-glass z-40 w-72 rounded-2xl p-2.5 text-sm shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-3)]">
                Map layers
              </p>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setAll(true)}
                  className="font-semibold text-[color:var(--color-text-2)] hover:text-[color:var(--color-ink)]"
                >
                  All
                </button>
                <span aria-hidden className="text-[color:var(--color-text-3)]">
                  /
                </span>
                <button
                  type="button"
                  onClick={() => setAll(false)}
                  className="font-semibold text-[color:var(--color-text-2)] hover:text-[color:var(--color-ink)]"
                >
                  None
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {CATEGORIES.map((cat) => {
                const items = DEFAULT_LAYERS.filter((l) => l.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="font-mono px-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-3)]">
                      {cat}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map((l) => {
                        const Icon = l.icon;
                        const on = visible[l.id] ?? true;
                        return (
                          <li key={l.id}>
                            <button
                              type="button"
                              onClick={() => {
                                posthog.capture("layer_toggled", {
                                  layer_id: l.id,
                                  layer_label: l.label,
                                  enabled: !on,
                                });
                                onChange(l.id, !on);
                              }}
                              aria-pressed={on}
                              className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-black/[0.04]"
                            >
                              <span
                                aria-hidden
                                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors"
                                style={{
                                  background: on ? `${l.hue}1f` : "rgba(0,0,0,0.04)",
                                  color: on ? l.hue : "var(--color-text-3)",
                                }}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              <span
                                className={`flex-1 truncate text-[13px] ${
                                  on ? "text-[color:var(--color-ink)]" : "text-[color:var(--color-text-3)]"
                                }`}
                              >
                                {l.label}
                              </span>
                              <Switch on={on} hue={l.hue} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>

            <p className="mt-2 px-2 pt-1 text-[11px] text-[color:var(--color-text-3)]">
              Toggle with <kbd className="font-mono rounded bg-black/[0.06] px-1 text-[10px]">1</kbd>–
              <kbd className="font-mono rounded bg-black/[0.06] px-1 text-[10px]">8</kbd>
            </p>
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Switch({ on, hue }: { on: boolean; hue: string }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? hue : "rgba(0,0,0,0.12)" }}
    >
      <motion.span
        animate={{ x: on ? 14 : 2 }}
        transition={{ type: "spring", duration: 0.28, bounce: 0.2 }}
        className="absolute h-3 w-3 rounded-full bg-white shadow-sm"
      />
    </span>
  );
}
