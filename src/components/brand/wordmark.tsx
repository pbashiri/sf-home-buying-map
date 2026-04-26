import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  size?: number;
};

/**
 * Theami wordmark — three irregular topographic contours with a single accent
 * dot at the summit. Echoes the way the product reads a place: layered,
 * concentric, hand-drawn. The accent "m" in the wordmark mirrors the dot.
 */
export default function Wordmark({ className, size = 22 }: Props) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="-translate-y-[0.5px]">
        <title>Theami logo</title>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-ink"
        >
          <path d="M27.6 16.2C28 21.2 23.6 26.2 17.1 26.6C10.5 27 5.1 23 4.7 16.7C4.3 10.5 9.5 5.2 16 5C22.4 4.8 27.2 10.1 27.6 16.2Z" />
          <path d="M23.5 15.6C23.9 19.4 21 22.4 17 22.7C12.7 23 9.2 20.4 8.7 16.3C8.3 12.4 11.5 9 15.5 8.9C19.5 8.8 23.1 11.7 23.5 15.6Z" />
          <path d="M19.6 15.4C19.9 17.4 18.3 19 16 19C13.8 19 12.2 17.5 12.2 15.6C12.2 13.5 13.8 12 16 12C18.2 12 19.4 13.4 19.6 15.4Z" />
        </g>
        <circle cx="16" cy="15.7" r="1.55" fill="var(--color-accent)" />
      </svg>
      <span
        className="font-display tabular leading-none"
        style={{ fontSize: size * 0.86, letterSpacing: "-0.02em" }}
      >
        thea<span style={{ color: "var(--color-accent)" }}>m</span>i
      </span>
    </div>
  );
}
