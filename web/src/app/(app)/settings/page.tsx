"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { CheckCircle, LogOut, User as UserIcon } from "lucide-react";

export default function SettingsPage() {
  const router    = useRouter();
  const supabase  = createClient();

  const [user, setUser]           = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        setDisplayName(
          data.user.user_metadata?.full_name ??
          data.user.user_metadata?.name ??
          data.user.email?.split("@")[0] ?? ""
        );
      }
    });
  }, []);

  const saveProfile = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() },
    });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  const inputClass = "w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
  const labelClass = "block text-xs font-medium text-zinc-500 mb-1.5";

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your account</p>
      </div>

      {/* Profile */}
      <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <UserIcon size={22} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-zinc-900">{displayName || user?.email}</p>
            <p className="text-sm text-zinc-400">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              value={user?.email ?? ""}
              disabled
              className={`${inputClass} bg-zinc-50 text-zinc-400 cursor-not-allowed`}
            />
            <p className="text-xs text-zinc-400 mt-1">
              {user?.email_confirmed_at ? "Email verified" : "Email not verified"}
            </p>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving || !displayName.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {saved && <CheckCircle size={14} />}
            {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Account info */}
      <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-6 mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Provider</span>
            <span className="text-zinc-900 capitalize font-medium">
              {user?.app_metadata?.provider ?? "email"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Member since</span>
            <span className="text-zinc-900 font-medium">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">User ID</span>
            <span className="text-zinc-400 font-mono text-xs">{user?.id?.slice(0, 8)}…</span>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Sign Out</h2>
        <p className="text-xs text-zinc-400 mb-4">You&apos;ll be redirected to the login page.</p>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <LogOut size={14} />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
