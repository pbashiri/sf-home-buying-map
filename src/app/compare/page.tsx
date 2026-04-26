import Link from "next/link";
import { Suspense } from "react";
import CompareClient from "./compare-client";

export const metadata = {
  title: "Compare addresses — Theami",
};

export default function ComparePage() {
  return (
    <main className="min-h-dvh px-6 py-8">
      <Link
        href="/"
        className="text-xs uppercase tracking-wider text-[color:var(--color-text-3)] hover:text-[color:var(--color-text-2)]"
      >
        ← Theami
      </Link>
      <h1 className="font-display mt-2 text-3xl">Compare</h1>
      <p className="mt-2 text-sm text-[color:var(--color-text-2)]">
        Up to 4 addresses, severity-coloured side by side.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-[color:var(--color-text-3)]">Loading…</p>}>
        <CompareClient />
      </Suspense>
    </main>
  );
}
