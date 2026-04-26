import Link from "next/link";

type Props = {
  /** Hide the long disclaimer text — used when the right panel is open and would compete with it. */
  compact?: boolean;
};

export default function Footer({ compact = false }: Props) {
  return (
    <footer className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-4 py-2 text-[10px] text-[color:var(--color-text-3)] sm:text-[11px]">
      {!compact && (
        <p className="pointer-events-auto max-w-[60%] leading-snug">
          For informational purposes only. Verify with licensed professionals before any purchase decision.
          Sources are public records and may be out of date.
        </p>
      )}
      <nav className="pointer-events-auto ml-auto flex items-center gap-3 font-mono uppercase tracking-wider">
        <Link href="/about" className="transition-colors hover:text-[color:var(--color-text-2)]">
          About
        </Link>
        <span aria-hidden>·</span>
        <Link href="/compare" className="transition-colors hover:text-[color:var(--color-text-2)]">
          Compare
        </Link>
      </nav>
    </footer>
  );
}
