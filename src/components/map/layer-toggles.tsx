"use client";

import * as Popover from "@radix-ui/react-popover";
import { Layers } from "lucide-react";
import posthog from "posthog-js";

export type LayerToggle = { id: string; label: string; hue: string };

export const DEFAULT_LAYERS: LayerToggle[] = [
  { id: "seismic_liquefaction", label: "Liquefaction (CGS)", hue: "var(--color-seismic)" },
  { id: "flood_fema", label: "Flood / SLR", hue: "var(--color-flood)" },
  { id: "zoning_upzone", label: "Upzoning corridors", hue: "var(--color-upzone)" },
  { id: "safety_hin", label: "High Injury Network", hue: "var(--color-safety)" },
  { id: "schools", label: "Schools", hue: "var(--color-schools)" },
  { id: "transit_bart", label: "BART", hue: "var(--color-transit)" },
  { id: "transit_muni_metro", label: "Muni Metro", hue: "var(--color-transit)" },
  { id: "climate_fog", label: "Fog belt", hue: "var(--color-fog)" },
];

type Props = {
  visible: Record<string, boolean>;
  onChange: (id: string, on: boolean) => void;
};

export default function LayerToggles({ visible, onChange }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Layer toggles"
          className="surface-glass flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium shadow"
        >
          <Layers className="h-4 w-4" aria-hidden />
          Layers
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          side="top"
          sideOffset={8}
          className="surface-glass z-40 w-64 rounded-xl p-2 text-sm shadow-xl"
        >
          <p className="px-2 pt-1 pb-2 text-[11px] uppercase tracking-wider text-[color:var(--color-text-3)]">
            Map layers
          </p>
          <ul className="space-y-0.5">
            {DEFAULT_LAYERS.map((l) => {
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
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-black/5"
                    aria-pressed={on}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: l.hue }}
                    />
                    <span className="flex-1 truncate">{l.label}</span>
                    <span
                      className={`tabular text-[10px] font-medium uppercase ${
                        on ? "text-[color:var(--color-ink)]" : "text-[color:var(--color-text-3)]"
                      }`}
                    >
                      {on ? "on" : "off"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-2 pt-2 text-[11px] text-[color:var(--color-text-3)]">
            Toggle a layer with <kbd className="rounded bg-black/5 px-1">1</kbd>–
            <kbd className="rounded bg-black/5 px-1">8</kbd>
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
