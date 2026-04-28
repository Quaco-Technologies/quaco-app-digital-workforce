interface Props {
  label?: string;
  color?: "red" | "green" | "blue";
}

const COLOR: Record<Required<Props>["color"], { dot: string; ring: string; text: string }> = {
  red:   { dot: "bg-red-500",   ring: "bg-red-400",   text: "text-red-600" },
  green: { dot: "bg-emerald-500", ring: "bg-emerald-400", text: "text-emerald-600" },
  blue:  { dot: "bg-blue-500",  ring: "bg-blue-400",  text: "text-blue-600" },
};

export function LiveDot({ label = "LIVE", color = "red" }: Props) {
  const c = COLOR[color];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${c.ring}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
      </span>
      {label && (
        <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{label}</span>
      )}
    </span>
  );
}
