import Wordmark from "@/components/brand/wordmark";
import Link from "next/link";

export const metadata = {
  title: "About Theami — methodology & sources",
};

const SOURCES: Array<{ label: string; description: string }> = [
  {
    label: "California Geological Survey",
    description: "Seismic Hazard Zones — liquefaction, landslide, fault traces.",
  },
  {
    label: "FEMA NFHL + NOAA SLR Viewer",
    description: "Coastal & riverine flood zones, sea-level-rise scenarios.",
  },
  {
    label: "SF Planning",
    description: "Family Zoning Plan, Combined Flood Map, Article 10/11 historic districts.",
  },
  {
    label: "DataSF",
    description: "DBI Permits, SFPD Incidents, Vision Zero High Injury Network, Street Trees, Soft-Story.",
  },
  { label: "BART Stations API + SFMTA Muni Metro", description: "Transit network proximity." },
  {
    label: "SFUSD + GreatSchools",
    description: "School locations, ratings, lottery zones (manual sync).",
  },
  { label: "UC Berkeley microclimate", description: "Fog and microclimate (Dawson Lab)." },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" aria-label="Theami home" className="inline-flex">
        <Wordmark size={20} />
      </Link>

      <header className="mt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-3)]">
          Methodology
        </p>
        <h1 className="font-display mt-1 text-[44px] leading-[1.05] tracking-tight">
          The opposite of Zillow.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[color:var(--color-text-2)]">
          Zillow tells you about the house. Theami tells you about the block — seismic substrate, upzoning
          pipeline, flood model, construction next door, schools, fog, noise. Every claim cites a primary
          source.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="font-display text-2xl tracking-tight">How it works</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[color:var(--color-text-2)]">
          <li className="grid grid-cols-[28px_1fr] items-baseline gap-3">
            <span className="font-mono tabular text-[11px] text-[color:var(--color-text-3)]">01</span>
            <span>You pick an SF address. We geocode it via Google Places.</span>
          </li>
          <li className="grid grid-cols-[28px_1fr] items-baseline gap-3">
            <span className="font-mono tabular text-[11px] text-[color:var(--color-text-3)]">02</span>
            <span>
              We run a structured spatial query against authoritative city / state / federal datasets and
              produce a typed array of <em>concerns</em>.
            </span>
          </li>
          <li className="grid grid-cols-[28px_1fr] items-baseline gap-3">
            <span className="font-mono tabular text-[11px] text-[color:var(--color-text-3)]">03</span>
            <span>
              A language model summarizes that array — weighted by your chosen 5 / 7 / 10 / 15-year horizon —
              and streams a brief into your panel. The model never invents claims; it only summarizes the
              structured array.
            </span>
          </li>
          <li className="grid grid-cols-[28px_1fr] items-baseline gap-3">
            <span className="font-mono tabular text-[11px] text-[color:var(--color-text-3)]">04</span>
            <span>Every bullet on screen is anchored to a source dataset and a freshness timestamp.</span>
          </li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl tracking-tight">Sources</h2>
        <ul className="mt-4 space-y-2.5">
          {SOURCES.map((s) => (
            <li key={s.label} className="surface-elevated rounded-xl p-3 text-sm">
              <p className="font-medium text-[color:var(--color-ink)]">{s.label}</p>
              <p className="mt-0.5 text-[color:var(--color-text-2)]">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-black/[0.07] bg-black/[0.025] p-5 text-sm leading-relaxed text-[color:var(--color-text-2)]">
        <h2 className="font-display text-base text-[color:var(--color-ink)]">Disclaimer</h2>
        <p className="mt-1.5">
          For informational purposes only. Verify with licensed professionals (structural engineer,
          real-estate attorney, insurance broker) before any purchase decision. Does not constitute real
          estate, legal, seismic, or financial advice. Sources are public records and may be out of date —
          every concern shows its <code className="font-mono">ingested_at</code>.
        </p>
      </section>

      <p className="mt-12 text-[11px] text-[color:var(--color-text-3)]">
        <Link href="/" className="hover:text-[color:var(--color-text-2)]">
          ← Back to map
        </Link>
      </p>
    </main>
  );
}
