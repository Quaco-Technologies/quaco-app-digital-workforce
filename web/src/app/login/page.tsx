"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usernameToEmail } from "@/lib/authUsername";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full px-4 py-3 text-sm bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 transition";

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) {
      setError("Wrong username or password.");
      setLoading(false);
      return;
    }
    router.push("/skiptrace");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* soft brand glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[42rem] rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="w-full max-w-sm relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/birdog-logo-white.png"
          alt="BirdDog"
          className="h-20 w-auto object-contain mx-auto mb-2"
        />
        <p className="text-center text-zinc-500 text-sm mb-8">Find the owner. Make the call.</p>

        <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-zinc-400 mb-6">Sign in to your investor account</p>

          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="text"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />

            {error && (
              <p className="text-xs px-3 py-2 rounded-lg bg-red-950/60 text-red-400 border border-red-900/60">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 pt-5 border-t border-white/10 text-center text-xs text-zinc-600">
            Accounts are created by your admin.
          </p>
        </div>
      </div>
    </div>
  );
}
