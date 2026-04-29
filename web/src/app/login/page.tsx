"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Zap, ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

type View = "signin" | "invite" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [view, setView] = useState<View>("signin");
  const [inviteCode, setInviteCode] = useState("");
  const [validatedCode, setValidatedCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const inputClass =
    "w-full px-3.5 py-2.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors";

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.onboarding.validateInvite(inviteCode.trim());
      setValidatedCode(inviteCode.trim().toUpperCase());
      setView("signup");
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Invalid code" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      router.push("/dashboard");
      router.refresh();
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
      return;
    }
    // Auto sign in (works when Supabase email confirm is disabled)
    const { error: signinErr } = await supabase.auth.signInWithPassword({ email, password });
    if (!signinErr) {
      try { await api.onboarding.useInvite(validatedCode); } catch { /* best-effort */ }
      router.push("/onboarding");
      router.refresh();
      return;
    }
    // Email confirmation required — let them know
    setMessage({
      type: "success",
      text: "Check your email to confirm your account, then sign in.",
    });
    setView("signin");
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Birddogs</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">

          {/* ── Sign In ── */}
          {view === "signin" && (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Welcome back</h1>
              <p className="text-sm text-zinc-400 mb-6">Sign in to your investor dashboard</p>

              <button
                onClick={signInWithGoogle}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 disabled:opacity-60 text-zinc-900 font-medium py-2.5 px-4 rounded-xl transition-colors text-sm mb-4"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                {googleLoading ? "Redirecting…" : "Continue with Google"}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-600">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              <form onSubmit={handleSignIn} className="space-y-3">
                <input type="email" required placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                <input type="password" required placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} minLength={6} className={inputClass} />

                {message && (
                  <p className={`text-xs px-3 py-2 rounded-lg ${
                    message.type === "error"
                      ? "bg-red-950 text-red-400 border border-red-900"
                      : "bg-green-950 text-green-400 border border-green-900"
                  }`}>{message.text}</p>
                )}

                <button type="submit" disabled={loading || googleLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-zinc-800 text-center">
                <p className="text-xs text-zinc-500 mb-2">Don&apos;t have an account?</p>
                <button
                  onClick={() => { setView("invite"); setMessage(null); }}
                  className="flex items-center justify-center gap-1.5 w-full py-2 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Join with an invite code <ArrowRight size={13} />
                </button>
              </div>
            </>
          )}

          {/* ── Enter Invite Code ── */}
          {view === "invite" && (
            <>
              <button onClick={() => { setView("signin"); setMessage(null); }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-5 transition-colors">
                <ArrowLeft size={12} /> Back to sign in
              </button>

              <h1 className="text-xl font-bold text-white mb-1">Enter invite code</h1>
              <p className="text-sm text-zinc-400 mb-6">
                Birddogs is invite-only during beta. Enter your code to get started.
              </p>

              <form onSubmit={handleValidateCode} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="e.g. QUACO-BETA-2025"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className={`${inputClass} tracking-widest font-mono`}
                  autoFocus
                />
                {message && (
                  <p className="text-xs px-3 py-2 rounded-lg bg-red-950 text-red-400 border border-red-900">
                    {message.text}
                  </p>
                )}
                <button type="submit" disabled={loading || !inviteCode.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                  {loading ? "Checking…" : <><span>Continue</span><ArrowRight size={14} /></>}
                </button>
              </form>
            </>
          )}

          {/* ── Create Account (after valid invite code) ── */}
          {view === "signup" && (
            <>
              <button onClick={() => { setView("invite"); setMessage(null); }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-5 transition-colors">
                <ArrowLeft size={12} /> Back
              </button>

              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-xs text-green-400 font-mono tracking-wide">{validatedCode}</span>
              </div>

              <h1 className="text-xl font-bold text-white mb-1">Create your account</h1>
              <p className="text-sm text-zinc-400 mb-6">You&apos;re in. Set up your login credentials.</p>

              <form onSubmit={handleSignUp} className="space-y-3">
                <input type="email" required placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                <input type="password" required placeholder="Password (min 6 characters)" value={password}
                  onChange={(e) => setPassword(e.target.value)} minLength={6} className={inputClass} />

                {message && (
                  <p className={`text-xs px-3 py-2 rounded-lg ${
                    message.type === "error"
                      ? "bg-red-950 text-red-400 border border-red-900"
                      : "bg-green-950 text-green-400 border border-green-900"
                  }`}>{message.text}</p>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                  {loading ? "Creating account…" : "Create account →"}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-zinc-600">
                By signing up you agree to our terms of service.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
