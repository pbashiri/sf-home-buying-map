import Link from "next/link";

export default function Footer() {
  return (
    <footer className="no-print fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 px-4 py-2 text-[10px] text-[color:var(--color-text-3)] sm:text-[11px]">
      <p className="max-w-[60%] leading-snug">
        For informational purposes only. Verify with licensed professionals before any purchase decision.
        Sources are public records and may be out of date.
      </p>
      <nav className="flex items-center gap-3">
        <Link href="/about" className="hover:text-[color:var(--color-text-2)]">
          About
        </Link>
        <Link href="/compare" className="hover:text-[color:var(--color-text-2)]">
          Compare
        </Link>
      </nav>
    </footer>
  );
}
