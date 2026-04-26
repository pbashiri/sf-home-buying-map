import { encodeAddress } from "@/lib/url";
import type { Horizon } from "@/types/concern";
import { createClient } from "@supabase/supabase-js";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function SharedHomePage({ params }: Props) {
  const { token } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) notFound();

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: home } = await supabase
    .from("saved_homes")
    .select("label,lat,lng,horizon,notes,share_enabled")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .single();

  if (!home) notFound();

  const horizon = Number(home.horizon) as Horizon;
  const href = `/?${encodeAddress({
    lat: Number(home.lat),
    lng: Number(home.lng),
    horizon,
    label: home.label as string,
  }).toString()}` as Route;

  return (
    <main className="min-h-dvh bg-[color:var(--color-bg)] px-6 py-10">
      <section className="surface-elevated mx-auto max-w-2xl rounded-3xl p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-3)]">
          Shared home
        </p>
        <h1 className="font-display mt-2 text-4xl leading-tight">{home.label as string}</h1>
        {(home.notes as string | null) && (
          <div className="mt-5 rounded-2xl bg-black/[0.04] p-4">
            <p className="font-mono mb-2 text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-3)]">
              Notes
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-2)]">
              {home.notes as string}
            </p>
          </div>
        )}
        <Link
          href={href}
          className="mt-6 inline-flex rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Open map brief
        </Link>
      </section>
    </main>
  );
}
