"use client";

import { useRouter } from "next/navigation";
import { Bell, Settings as SettingsIcon, LogOut, Zap, Moon, User, Mail, KeyRound, CheckCircle2, Sparkles, Clock, MessageSquare, FileSignature } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Cute critter avatars — picked by the user, persisted in localStorage.
const CRITTERS = [
  { id: "panda",    emoji: "🐼", name: "Panda" },
  { id: "fox",      emoji: "🦊", name: "Fox" },
  { id: "chicken",  emoji: "🐔", name: "Chicken" },
  { id: "cow",      emoji: "🐮", name: "Cow" },
  { id: "dog",      emoji: "🐶", name: "Dog" },
  { id: "cat",      emoji: "🐱", name: "Cat" },
  { id: "rabbit",   emoji: "🐰", name: "Rabbit" },
  { id: "bear",     emoji: "🐻", name: "Bear" },
  { id: "koala",    emoji: "🐨", name: "Koala" },
  { id: "tiger",    emoji: "🐯", name: "Tiger" },
  { id: "lion",     emoji: "🦁", name: "Lion" },
  { id: "frog",     emoji: "🐸", name: "Frog" },
  { id: "monkey",   emoji: "🐵", name: "Monkey" },
  { id: "pig",      emoji: "🐷", name: "Pig" },
  { id: "unicorn",  emoji: "🦄", name: "Unicorn" },
  { id: "octopus",  emoji: "🐙", name: "Octopus" },
  { id: "raccoon",  emoji: "🦝", name: "Raccoon" },
  { id: "otter",    emoji: "🦦", name: "Otter" },
];

type PanelKey = "notifications" | "settings" | "avatar" | null;

export function FloatingActions() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState<PanelKey>(null);
  const [critter, setCritter] = useState(CRITTERS[0]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    const saved = typeof window !== "undefined" ? localStorage.getItem("birddogs.critter") : null;
    if (saved) {
      const found = CRITTERS.find((c) => c.id === saved);
      if (found) setCritter(found);
    }
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const pickCritter = (c: typeof CRITTERS[number]) => {
    setCritter(c);
    if (typeof window !== "undefined") localStorage.setItem("birddogs.critter", c.id);
  };

  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); };

  return (
    <div ref={wrapRef} className="fixed top-5 right-5 z-40 hidden md:block">
      <div className="flex flex-col items-center gap-2">
        {/* Notifications — top of triangle */}
        <button
          aria-label="Notifications"
          className="blob blob-light relative"
          onClick={() => setOpen(open === "notifications" ? null : "notifications")}
        >
          <Bell size={15} strokeWidth={1.75} />
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-[#ebeae5]" />
        </button>

        {/* Bottom row: settings + avatar */}
        <div className="flex items-center gap-2">
          <button
            aria-label="Settings"
            className="blob blob-light"
            onClick={() => setOpen(open === "settings" ? null : "settings")}
          >
            <SettingsIcon size={15} strokeWidth={1.75} />
          </button>

          <button
            aria-label="Account"
            className="blob blob-accent"
            onClick={() => setOpen(open === "avatar" ? null : "avatar")}
          >
            <span className="emoji-glyph text-[20px] leading-none">{critter.emoji}</span>
          </button>
        </div>
      </div>

      {open === "notifications" && (
        <Panel wide>
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold text-slate-900 tracking-tight">Notifications</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Today</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              3 new
            </span>
          </div>
          <div className="px-2 pb-2">
            <NotifRow
              icon={<FileSignature size={13} strokeWidth={2} />}
              tone="emerald"
              who="Maria H."
              action="signed the contract"
              detail="3857 N High St · $187,500"
              time="2m"
              unread
            />
            <NotifRow
              icon={<MessageSquare size={13} strokeWidth={2} />}
              tone="blue"
              who="James P."
              action="replied to your offer"
              detail={`“Send me the offer in writing”`}
              time="14m"
              unread
            />
            <NotifRow
              icon={<Clock size={13} strokeWidth={2} />}
              tone="amber"
              who="Marcus C."
              action="sent a counter-offer"
              detail="Asking $215k · you offered $208k"
              time="1h"
              unread
            />
          </div>
          <button
            onClick={() => setOpen(null)}
            className="w-full text-center text-[12px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 py-3 transition-colors border-t border-slate-100"
          >
            Mark all as read
          </button>
        </Panel>
      )}

      {open === "settings" && (
        <Panel>
          <PanelHeader title="Settings" subtitle={email} />
          <div className="py-1.5">
            <SettingRow icon={<User size={13} />}      label="Profile" />
            <SettingRow icon={<Mail size={13} />}      label="Email & SMS" />
            <SettingRow icon={<KeyRound size={13} />}  label="Security" />
            <SettingRow icon={<Moon size={13} />}      label="Appearance" right="Light" />
            <SettingRow icon={<Zap size={13} />}       label="Install app" />
          </div>
          <div className="border-t border-slate-100 py-1">
            <button onClick={signOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50 transition-colors">
              <LogOut size={13} strokeWidth={1.75} /> Sign out
            </button>
          </div>
        </Panel>
      )}

      {open === "avatar" && (
        <Panel wide>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <span className="emoji-glyph text-[22px] leading-none">{critter.emoji}</span>
                <span>{email?.split("@")[0] || "you"}</span>
              </span>
            }
            subtitle={
              <span className="flex items-center gap-1.5 text-[11px]">
                <Sparkles size={10} className="text-amber-500" />
                Pick your spirit animal
              </span>
            }
          />
          <div className="grid grid-cols-6 gap-1.5 p-3">
            {CRITTERS.map((c) => {
              const active = c.id === critter.id;
              return (
                <button
                  key={c.id}
                  onClick={() => pickCritter(c)}
                  title={c.name}
                  className={`aspect-square rounded-xl flex items-center justify-center text-[22px] transition-all hover:scale-110 hover:bg-slate-50 relative ${
                    active ? "bg-gradient-to-br from-indigo-50 to-blue-50 ring-2 ring-indigo-400" : ""
                  }`}
                >
                  <span className="emoji-glyph leading-none">{c.emoji}</span>
                  {active && (
                    <CheckCircle2 size={11} className="absolute -top-1 -right-1 text-indigo-600 fill-white" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100 py-1">
            <button onClick={signOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-rose-600 hover:bg-rose-50 transition-colors">
              <LogOut size={13} strokeWidth={1.75} /> Sign out
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Panel({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={`absolute right-0 top-full mt-3 ${wide ? "w-80" : "w-72"} bg-white rounded-2xl overflow-hidden animate-fade-up shadow-[0_8px_32px_-8px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.04),0_24px_64px_-16px_rgba(15,23,42,0.18)]`}
    >
      {children}
    </div>
  );
}

function PanelHeader({ title, subtitle }: { title: React.ReactNode; subtitle: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-slate-100">
      <p className="text-[13px] font-semibold text-slate-900">{title}</p>
      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
    </div>
  );
}

function PanelFooter({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-center text-[12px] font-medium text-indigo-600 hover:bg-indigo-50 py-2.5 transition-colors border-t border-slate-100"
    >
      {label}
    </button>
  );
}

function SettingRow({ icon, label, right }: { icon: React.ReactNode; label: string; right?: string }) {
  return (
    <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors">
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {right && <span className="text-[11px] text-slate-400">{right}</span>}
    </button>
  );
}

function NotifRow({
  icon, tone, who, action, detail, time, unread = false,
}: {
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "amber";
  who: string;
  action: string;
  detail: string;
  time: string;
  unread?: boolean;
}) {
  const tones: Record<string, { bg: string; text: string; ring: string }> = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100" },
    blue:    { bg: "bg-blue-50",    text: "text-blue-600",    ring: "ring-blue-100" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-600",   ring: "ring-amber-100" },
  };
  const t = tones[tone];
  return (
    <button className="w-full text-left flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group relative">
      {unread && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-indigo-500" />
      )}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${t.bg} ${t.text} ring-1 ${t.ring}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] leading-snug text-slate-700">
          <span className="font-semibold text-slate-900">{who}</span>{" "}
          <span className="text-slate-500">{action}</span>
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{detail}</p>
      </div>
      <span className="text-[10px] text-slate-400 font-medium tabular-nums shrink-0 mt-1">{time}</span>
    </button>
  );
}
