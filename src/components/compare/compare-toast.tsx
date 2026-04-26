"use client";

import type { AddressUrlState } from "@/lib/url";
import { compareSerialise } from "@/lib/url";
import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import posthog from "posthog-js";

type Props = {
  saved: AddressUrlState[];
  onClear: () => void;
};

export default function CompareToast({ saved, onClear }: Props) {
  if (saved.length < 2) return null;
  const href = `/compare?addrs=${encodeURIComponent(compareSerialise(saved))}` as Route;
  return (
    <div className="no-print fixed inset-x-0 bottom-12 z-30 flex justify-center">
      <div className="surface-glass flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg">
        <span className="font-medium">{saved.length} saved</span>
        <span className="text-[color:var(--color-text-3)]">·</span>
        <Link
          href={href}
          className="inline-flex items-center gap-1 font-semibold text-[color:var(--color-ink)] hover:underline"
        >
          Compare <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => {
            posthog.capture("compare_cleared", { address_count: saved.length });
            onClear();
          }}
          className="ml-2 text-[color:var(--color-text-3)] hover:text-[color:var(--color-text-2)]"
        >
          clear
        </button>
      </div>
    </div>
  );
}
