import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";
export const revalidate = 0;

const BodyZ = z.object({
  saved_home_id: z.string().uuid(),
  message: z.string().min(1).max(1200),
});

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function buildReply(input: {
  label: string;
  lat: number;
  lng: number;
  horizon: number;
  notes: string | null;
  message: string;
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const noteHint = input.notes
      ? "I factored in your notes too."
      : "Add notes and I can use them in this thread.";
    return `For ${input.label}, I would look at the ${input.horizon}-year risk brief, then compare the biggest alerts and watches against your priorities. ${noteHint} Ask me something specific like "what should I verify before offer?" or "how does this compare to my other saved homes?"`;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system:
      "You are Theami, a concise SF home-shopping analyst. Use only the saved-home context and user notes provided. Do not invent undisclosed facts. Suggest due-diligence next steps when useful.",
    messages: [
      {
        role: "user",
        content: `Saved home:
Label: ${input.label}
Coordinates: ${input.lat}, ${input.lng}
Horizon: ${input.horizon} years
User notes: ${input.notes || "(none)"}

Question: ${input.message}`,
      },
    ],
  });

  return res.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  const supabase = supabaseServer();
  if (!supabase || !token) {
    return Response.json({ error: "Supabase server auth is not configured." }, { status: 401 });
  }

  const body = BodyZ.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return Response.json({ error: "Sign in again to chat about saved homes." }, { status: 401 });
  }

  const { data: home, error: homeError } = await supabase
    .from("saved_homes")
    .select("id,label,lat,lng,horizon,notes")
    .eq("id", body.data.saved_home_id)
    .eq("user_id", user.id)
    .single();

  if (homeError || !home) {
    return Response.json({ error: "Saved home not found." }, { status: 404 });
  }

  await supabase.from("saved_home_messages").insert({
    saved_home_id: home.id,
    user_id: user.id,
    role: "user",
    content: body.data.message,
  });

  const reply = await buildReply({
    label: home.label as string,
    lat: Number(home.lat),
    lng: Number(home.lng),
    horizon: Number(home.horizon),
    notes: (home.notes as string | null) ?? null,
    message: body.data.message,
  });

  await supabase.from("saved_home_messages").insert({
    saved_home_id: home.id,
    user_id: user.id,
    role: "assistant",
    content: reply,
  });

  return Response.json({ reply });
}
