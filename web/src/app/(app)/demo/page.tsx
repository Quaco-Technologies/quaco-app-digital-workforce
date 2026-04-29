"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { DemoState, DemoStage } from "@/lib/types";
import { LiveDot } from "@/components/LiveDot";
import {
  Play, CheckCircle2, Loader2, MessageSquare, Sparkles,
  Phone, FileSignature, Send, ChevronRight,
} from "lucide-react";

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export default function DemoPage() {
  const [state, setState] = useState<DemoState | null>(null);
  const [phone, setPhone] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setStarting(true);
    setError(null);
    setState(null);
    try {
      const res = await api.demo.start(phone.trim() || undefined);
      // Poll for live progress
      pollRef.current = setInterval(async () => {
        try {
          const s = await api.demo.status(res.demo_id);
          setState(s);
          if (s.is_complete) stop();
        } catch (e) {
          stop();
          setError(e instanceof Error ? e.message : "Lost connection to demo");
        }
      }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  const reset = () => {
    stop();
    setState(null);
    setError(null);
  };

  const isRunning = state && !state.is_complete;
  const sms = state?.sms_sent ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              <Sparkles size={22} className="text-blue-600" /> Investor Demo
            </h1>
            {isRunning && <LiveDot color="red" label="LIVE" />}
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            End-to-end pipeline → SMS → contract, with real texts to your phone.
          </p>
        </div>
      </div>

      {!state ? (
        <div className="relative overflow-hidden rounded-3xl text-white shadow-xl shadow-blue-500/30 mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-cyan-600 to-emerald-600 animate-gradient" />
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/40 blur-3xl rounded-full" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-300/40 blur-3xl rounded-full" />
          </div>
          <div className="relative p-8">
            <h2 className="text-2xl font-bold mb-1">Run the full pitch</h2>
            <p className="text-blue-50 max-w-xl mb-6">
              Watch all 6 stages execute live: scrape county records → skip trace → calculate
              offer → send opening SMS → AI negotiation → contract. Real SMS land on the phone
              you specify.
            </p>
            <div className="flex gap-2 max-w-md">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567 (or use default)"
                className="flex-1 bg-white/15 border border-white/30 text-white placeholder-white/70 px-4 py-3 rounded-xl focus:outline-none focus:bg-white/25 focus:border-white/50"
              />
              <button
                onClick={start}
                disabled={starting}
                className="bg-white hover:bg-blue-50 text-blue-700 disabled:opacity-60 font-semibold px-5 py-3 rounded-xl transition-all hover:scale-[1.02] flex items-center gap-2"
              >
                {starting ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                {starting ? "Starting…" : "Start Demo"}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-100 bg-red-900/30 border border-red-200/30 rounded-lg px-3 py-2 mt-3">{error}</p>
            )}
            <p className="text-[11px] text-blue-100 mt-4 opacity-80">
              Leave the phone field blank to use the default test recipient. SMS delivery requires Telenyx to be configured.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
            {/* Stage timeline */}
            <div className="md:col-span-3 bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-900">Pipeline Progress</h3>
                <span className="text-xs text-zinc-500">
                  Recipient: <span className="text-blue-600 font-medium">{fmtPhone(state.recipient_phone)}</span>
                </span>
              </div>
              <ol className="relative space-y-4 stagger-children">
                {state.stages.map((s, i) => <StageRow key={s.name} stage={s} index={i + 1} />)}
              </ol>
            </div>

            {/* Live SMS feed */}
            <div className="md:col-span-2 bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl p-5 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  <MessageSquare size={15} className="text-blue-600" /> Texts Sent
                </h3>
                <LiveDot color="red" label={isRunning ? "LIVE" : "DONE"} />
              </div>
              {sms.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-zinc-400 py-8">
                  Waiting for outreach stage…
                </div>
              ) : (
                <div className="flex-1 space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {sms.map((m, i) => (
                    <div key={i} className="animate-slide-in">
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1">
                        <Phone size={9} />
                        <span>To {fmtPhone(m.to)}</span>
                        <span>·</span>
                        <span className="font-semibold uppercase tracking-wide text-blue-600">{m.kind}</span>
                        {m.delivered && <CheckCircle2 size={10} className="text-emerald-500 ml-auto" />}
                      </div>
                      <div className="bg-gradient-to-br from-blue-500 to-emerald-500 text-white text-xs px-3.5 py-2.5 rounded-2xl rounded-tl-sm leading-relaxed shadow-sm">
                        {m.body}
                      </div>
                      {!m.delivered && m.error && (
                        <p className="text-[10px] text-amber-700 mt-1 italic">⚠ {m.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {state.is_complete && (
            <div className="bg-gradient-to-br from-emerald-50/90 to-blue-50/90 backdrop-blur-sm border border-emerald-200 rounded-2xl p-6 mb-4 animate-fade-up">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <FileSignature size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Deal closed in {Math.round((Date.now() / 1000 - state.started_at))}s</p>
                  <p className="text-xs text-zinc-600">
                    All 6 stages complete. {state.sms_sent.filter((m) => m.delivered).length} of {state.sms_sent.length} SMS delivered.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {state.contract_url && (
                  <a
                    href={state.contract_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    <FileSignature size={13} /> View contract <ChevronRight size={13} />
                  </a>
                )}
                <button
                  onClick={reset}
                  className="bg-gradient-to-br from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-[1.02]"
                >
                  Run again
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StageRow({ stage, index }: { stage: DemoStage; index: number }) {
  const isDone = stage.status === "complete";
  const isRunning = stage.status === "running";
  const elapsed = stage.started_at && stage.completed_at
    ? `${(stage.completed_at - stage.started_at).toFixed(1)}s`
    : null;

  return (
    <li className="flex items-start gap-3">
      <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
        isDone
          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30"
          : isRunning
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30"
            : "bg-zinc-100 text-zinc-400"
      }`}>
        {isDone
          ? <CheckCircle2 size={16} />
          : isRunning
            ? <Loader2 size={16} className="animate-spin" />
            : <span className="text-xs font-bold">{index}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${isDone ? "text-zinc-900" : isRunning ? "text-blue-700" : "text-zinc-400"}`}>
            {stage.label}
          </p>
          {isRunning && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded animate-pulse">
              Running
            </span>
          )}
          {isDone && elapsed && (
            <span className="text-[10px] text-emerald-600 font-medium">{elapsed}</span>
          )}
        </div>
        <p className={`text-xs leading-relaxed mt-0.5 ${isRunning || isDone ? "text-zinc-500" : "text-zinc-300"}`}>
          {stage.detail}
        </p>
      </div>
    </li>
  );
}
