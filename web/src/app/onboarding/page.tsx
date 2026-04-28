"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Zap, ArrowRight, ArrowLeft, Check, Building2, TrendingUp, Handshake, Sprout } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const PROPERTY_TYPES = ["Single Family", "Multi-Family", "Condo", "Townhouse"];

const INVESTOR_TYPES = [
  {
    value: "fix_flip",
    icon: Building2,
    label: "Fix & Flip",
    desc: "Buy distressed, renovate, sell for profit",
    color: "border-orange-500/40 bg-orange-500/5 text-orange-300",
    iconColor: "text-orange-400",
  },
  {
    value: "buy_hold",
    icon: TrendingUp,
    label: "Buy & Hold",
    desc: "Build a rental portfolio for long-term cash flow",
    color: "border-blue-500/40 bg-blue-500/5 text-blue-300",
    iconColor: "text-blue-400",
  },
  {
    value: "wholesale",
    icon: Handshake,
    label: "Wholesale",
    desc: "Assign contracts to other investors",
    color: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
    iconColor: "text-emerald-400",
  },
  {
    value: "new",
    icon: Sprout,
    label: "Just Getting Started",
    desc: "Exploring real estate investing for the first time",
    color: "border-green-500/40 bg-green-500/5 text-green-300",
    iconColor: "text-green-400",
  },
];

const EXPERIENCE_LEVELS = [
  { value: "new", label: "Brand new", deals: "0 deals" },
  { value: "emerging", label: "Getting started", deals: "1–5 deals" },
  { value: "experienced", label: "Experienced", deals: "6–20 deals" },
  { value: "veteran", label: "Veteran", deals: "20+ deals" },
];

const REFERRAL_SOURCES = ["Referral from a friend", "Google / Search", "Social media", "Podcast", "Real estate community", "Other"];

const TOTAL_STEPS = 5;

interface FormData {
  full_name: string;
  company_name: string;
  phone: string;
  investor_type: string;
  primary_state: string;
  target_markets: string;
  typical_min_price: string;
  typical_max_price: string;
  typical_property_types: string[];
  experience_level: string;
  monthly_deal_target: string;
  referral_source: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    full_name: "",
    company_name: "",
    phone: "",
    investor_type: "",
    primary_state: "",
    target_markets: "",
    typical_min_price: "",
    typical_max_price: "",
    typical_property_types: [],
    experience_level: "",
    monthly_deal_target: "",
    referral_source: "",
  });

  const set = (key: keyof FormData, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const togglePropertyType = (type: string) => {
    set(
      "typical_property_types",
      form.typical_property_types.includes(type)
        ? form.typical_property_types.filter((t) => t !== type)
        : [...form.typical_property_types, type]
    );
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const canAdvance = () => {
    if (step === 1) return form.full_name.trim().length > 0;
    if (step === 2) return form.investor_type !== "";
    if (step === 3) return form.primary_state !== "";
    if (step === 4) return true;
    if (step === 5) return form.experience_level !== "";
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.onboarding.saveProfile({
        full_name: form.full_name || undefined,
        company_name: form.company_name || undefined,
        phone: form.phone || undefined,
        investor_type: form.investor_type as never || undefined,
        primary_state: form.primary_state || undefined,
        target_markets: form.target_markets || undefined,
        typical_min_price: form.typical_min_price ? parseInt(form.typical_min_price) : undefined,
        typical_max_price: form.typical_max_price ? parseInt(form.typical_max_price) : undefined,
        typical_property_types: form.typical_property_types.length > 0 ? form.typical_property_types : undefined,
        experience_level: form.experience_level as never || undefined,
        monthly_deal_target: form.monthly_deal_target ? parseInt(form.monthly_deal_target) : undefined,
        referral_source: form.referral_source || undefined,
        onboarding_completed: true,
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors";

  const labelClass = "block text-xs font-medium text-zinc-400 mb-1.5";

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-white font-semibold tracking-tight">Acquire</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i + 1 <= step ? "bg-blue-500" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-600 mt-2">Step {step} of {TOTAL_STEPS}</p>
      </div>

      <div className="w-full max-w-md">
        {/* ── Step 1: Your name ── */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Let&apos;s get you set up</h1>
            <p className="text-sm text-zinc-400 mb-8">Tell us a bit about yourself</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Your name *</label>
                <input type="text" placeholder="First and last name" value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)} className={inputClass} autoFocus />
              </div>
              <div>
                <label className={labelClass}>Company or LLC name <span className="text-zinc-600">(optional)</span></label>
                <input type="text" placeholder="e.g. Apex REI LLC" value={form.company_name}
                  onChange={(e) => set("company_name", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone <span className="text-zinc-600">(optional)</span></label>
                <input type="tel" placeholder="(555) 000-0000" value={form.phone}
                  onChange={(e) => set("phone", e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Investor type ── */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">What kind of investor are you?</h1>
            <p className="text-sm text-zinc-400 mb-8">This helps us tailor your deal recommendations</p>
            <div className="space-y-3">
              {INVESTOR_TYPES.map(({ value, icon: Icon, label, desc, color, iconColor }) => (
                <button
                  key={value}
                  onClick={() => set("investor_type", value)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                    form.investor_type === value
                      ? `${color} border-2`
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                  }`}
                >
                  <div className="mt-0.5">
                    <Icon size={20} className={form.investor_type === value ? iconColor : "text-zinc-500"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${form.investor_type === value ? "" : "text-white"}`}>{label}</p>
                    <p className={`text-xs mt-0.5 ${form.investor_type === value ? "opacity-80" : "text-zinc-500"}`}>{desc}</p>
                  </div>
                  {form.investor_type === value && (
                    <Check size={16} className={iconColor} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Target markets ── */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Where do you invest?</h1>
            <p className="text-sm text-zinc-400 mb-8">We&apos;ll focus your searches on these areas</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Primary state *</label>
                <select
                  value={form.primary_state}
                  onChange={(e) => set("primary_state", e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Select a state…</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Target cities / areas <span className="text-zinc-600">(optional)</span></label>
                <textarea
                  placeholder="e.g. Atlanta, Decatur, Sandy Springs"
                  value={form.target_markets}
                  onChange={(e) => set("target_markets", e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
                <p className="text-xs text-zinc-600 mt-1">Separate multiple cities with commas</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Buy box ── */}
        {step === 4 && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Your typical buy box</h1>
            <p className="text-sm text-zinc-400 mb-8">Properties within these criteria will be prioritized</p>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Min price</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input type="number" placeholder="50,000" value={form.typical_min_price}
                      onChange={(e) => set("typical_min_price", e.target.value)}
                      className={`${inputClass} pl-7`} min={0} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Max price</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input type="number" placeholder="300,000" value={form.typical_max_price}
                      onChange={(e) => set("typical_max_price", e.target.value)}
                      className={`${inputClass} pl-7`} min={0} />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Property types <span className="text-zinc-600">(select all that apply)</span></label>
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => togglePropertyType(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                        form.typical_property_types.includes(type)
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Experience & goals ── */}
        {step === 5 && (
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Experience & goals</h1>
            <p className="text-sm text-zinc-400 mb-8">Help us understand where you are in your journey</p>
            <div className="space-y-5">
              <div>
                <label className={labelClass}>How many deals have you done? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPERIENCE_LEVELS.map(({ value, label, deals }) => (
                    <button
                      key={value}
                      onClick={() => set("experience_level", value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        form.experience_level === value
                          ? "bg-blue-600/10 border-blue-500 text-white"
                          : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 text-zinc-300"
                      }`}
                    >
                      <p className="font-semibold text-sm">{label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{deals}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Monthly deal target <span className="text-zinc-600">(optional)</span></label>
                <input type="number" placeholder="e.g. 2" value={form.monthly_deal_target}
                  onChange={(e) => set("monthly_deal_target", e.target.value)}
                  className={inputClass} min={0} max={100} />
              </div>

              <div>
                <label className={labelClass}>How did you hear about Acquire? <span className="text-zinc-600">(optional)</span></label>
                <select value={form.referral_source}
                  onChange={(e) => set("referral_source", e.target.value)}
                  className={`${inputClass} cursor-pointer`}>
                  <option value="">Select one…</option>
                  {REFERRAL_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 1 ? (
            <button onClick={back} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              <ArrowLeft size={14} /> Back
            </button>
          ) : <div />}

          {step < TOTAL_STEPS ? (
            <button
              onClick={next}
              disabled={!canAdvance()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!canAdvance() || saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-all text-sm"
            >
              {saving ? "Saving…" : "Go to dashboard →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
