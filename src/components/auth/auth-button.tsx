"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Mail, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  onSessionChange?: (session: Session | null) => void;
};

export default function AuthButton({ onSessionChange }: Props) {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(() => (configured ? createSupabaseBrowserClient() : null), [configured]);
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(
    configured ? null : "Connect Supabase env vars to enable login.",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      onSessionChange?.(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      onSessionChange?.(nextSession);
    });
    return () => subscription.unsubscribe();
  }, [onSessionChange, supabase]);

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setMessage(error.message);
    setBusy(false);
  }

  async function signInWithEmail() {
    if (!supabase || !email.trim()) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setMessage(error ? error.message : "Check your email for the sign-in link.");
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setOpen(false);
  }

  const label = session?.user.email ?? "Sign in";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="surface-glass inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-md transition-transform hover:scale-[1.02]"
      >
        <UserRound className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-[150px] truncate">{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="surface-glass absolute right-0 mt-2 w-[300px] rounded-2xl p-3 shadow-xl"
          >
            {session ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Signed in</p>
                  <p className="truncate text-xs text-[color:var(--color-text-3)]">{session.user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-3 py-2 text-xs font-semibold text-white"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Sign out
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={!configured || busy}
                  onClick={signInWithGoogle}
                  className="w-full rounded-full bg-black px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue with Google
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="min-w-0 flex-1 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-sm outline-none focus:border-black/30"
                  />
                  <button
                    type="button"
                    disabled={!configured || busy || !email.trim()}
                    onClick={signInWithEmail}
                    aria-label="Send magic link"
                    className="rounded-full bg-black p-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {message && (
                  <p className="text-xs leading-snug text-[color:var(--color-text-3)]">{message}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
