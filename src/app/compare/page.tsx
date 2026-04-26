import Wordmark from "@/components/brand/wordmark";
import Link from "next/link";
import { Suspense } from "react";
import CompareClient from "./compare-client";

export const metadata = {
  title: "Compare addresses — Theami",
};

export default function ComparePage() {
  return (
    <main className="min-h-dvh px-6 py-8">
      <Link href="/" className="inline-flex" aria-label="Theami home">
        <Wordmark size={20} />
      </Link>
      <h1 className="font-display mt-6 text-4xl tracking-tight">Compare</h1>
      <p className="font-mono mt-1 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-3)]">
        Up to 4 addresses · severity-coloured side by side
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-[color:var(--color-text-3)]">Loading…</p>}>
        <CompareClient />
      </Suspense>
    </main>
  );
}
