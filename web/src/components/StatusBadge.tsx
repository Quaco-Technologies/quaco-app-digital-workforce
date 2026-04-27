import { cn, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import { LeadStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        STATUS_COLOR[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
