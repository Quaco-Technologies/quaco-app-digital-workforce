import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { LeadStatus, DealRecommendation, PipelineRecommendation } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt$$(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  skip_traced: "Skip Traced",
  enriched: "Enriched",
  analyzed: "Analyzed",
  outreach: "Outreach",
  negotiating: "Negotiating",
  under_contract: "Under Contract",
  dead: "Dead",
  closed: "Closed",
};

export const STATUS_COLOR: Record<LeadStatus, string> = {
  new: "bg-zinc-100 text-zinc-600",
  skip_traced: "bg-blue-50 text-blue-700",
  enriched: "bg-indigo-50 text-indigo-700",
  analyzed: "bg-yellow-50 text-yellow-700",
  outreach: "bg-orange-50 text-orange-700",
  negotiating: "bg-purple-50 text-purple-700",
  under_contract: "bg-green-50 text-green-700",
  dead: "bg-red-50 text-red-500",
  closed: "bg-emerald-50 text-emerald-700",
};

export const REC_COLOR: Record<DealRecommendation, string> = {
  pursue: "text-green-600",
  watch: "text-yellow-600",
  skip: "text-red-500",
};

export const PIPELINE_REC_STYLE: Record<PipelineRecommendation, { label: string; className: string }> = {
  pursue: { label: "Pursue", className: "bg-green-50 text-green-700 border border-green-200" },
  needs_review: { label: "Review", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  skip: { label: "Skip", className: "bg-red-50 text-red-600 border border-red-200" },
};
