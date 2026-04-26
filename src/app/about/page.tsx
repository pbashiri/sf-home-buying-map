import Link from "next/link";

export const metadata = {
  title: "About Theami — methodology & sources",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/"
        className="text-xs uppercase tracking-wider text-[color:var(--color-text-3)] hover:text-[color:var(--color-text-2)]"
      >
        ← Theami
      </Link>
      <h1 className="font-display mt-4 text-4xl leading-tight">About Theami</h1>
      <p className="mt-3 text-base leading-relaxed text-[color:var(--color-text-2)]">
        Theami is the opposite of Zillow. Zillow tells you about the house. Theami tells you about the block —
        seismic substrate, upzoning pipeline, flood model, construction next door, schools, fog, noise. Every
        claim cites a primary source.
      </p>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-2xl">How it works</h2>
        <ol className="list-decimal pl-5 text-sm leading-relaxed text-[color:var(--color-text-2)]">
          <li>You pick an SF address. We geocode it via Google Places.</li>
          <li>
            We run a structured spatial query against authoritative city / state / federal datasets and
            produce a typed array of <em>concerns</em>.
          </li>
          <li>
            A language model summarizes that array — weighted by your chosen 5/7/10/15-year horizon — and
            streams a brief into your panel. The model never invents claims; it only summarizes the structured
            array.
          </li>
          <li>Every bullet on screen is anchored to a source dataset and a freshness timestamp.</li>
        </ol>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-2xl">Sources</h2>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-[color:var(--color-text-2)]">
          <li>California Geological Survey — Seismic Hazard Zones</li>
          <li>FEMA NFHL + NOAA SLR Viewer</li>
          <li>SF Planning — SF Family Zoning Plan + Combined Flood Map</li>
          <li>DataSF — DBI Permits, SFPD Incidents, Vision Zero HIN, Street Trees, Soft-Story</li>
          <li>BART Stations API + SFMTA Muni Metro</li>
          <li>SFUSD school directory + GreatSchools (manual sync)</li>
          <li>UC Berkeley microclimate (Dawson Lab)</li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-2xl">Disclaimer</h2>
        <p className="text-sm leading-relaxed text-[color:var(--color-text-2)]">
          For informational purposes only. Verify with licensed professionals (structural engineer,
          real-estate attorney, insurance broker) before any purchase decision. Does not constitute real
          estate, legal, seismic, or financial advice. Sources are public records and may be out of date —
          every concern shows its <code>ingested_at</code>.
        </p>
      </section>
    </main>
  );
}
