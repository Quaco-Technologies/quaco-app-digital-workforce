import { Deal } from "@/lib/types";
import { fmt$$, REC_COLOR } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function DealCard({ deal }: { deal: Deal }) {
  const score = deal.deal_score ?? 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900">Deal Analysis</h3>
        {deal.recommendation && (
          <span
            className={cn(
              "text-sm font-semibold capitalize",
              REC_COLOR[deal.recommendation]
            )}
          >
            {deal.recommendation}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "ARV", value: fmt$$(deal.arv) },
          { label: "Repair Est.", value: fmt$$(deal.repair_estimate) },
          { label: "Max Offer", value: fmt$$(deal.max_offer) },
          { label: "Initial Offer", value: fmt$$(deal.initial_offer) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-50 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">{label}</p>
            <p className="font-semibold text-zinc-900">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-500">Deal Score</span>
          <span className="text-xs font-semibold text-zinc-700">
            {(score * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              score >= 0.65
                ? "bg-green-500"
                : score >= 0.4
                ? "bg-yellow-400"
                : "bg-red-400"
            )}
            style={{ width: `${score * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
