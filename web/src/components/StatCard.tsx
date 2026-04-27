import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={cn("text-2xl font-bold text-zinc-900", accent)}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}
