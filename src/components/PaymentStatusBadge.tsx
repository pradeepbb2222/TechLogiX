
import type { PaymentStatus } from "@/lib/types";

export const PAYMENT_STATES: Record<
  PaymentStatus,
  { label: string; classes: string; dot: string }
> = {
  not_started: {
    label: "Not Started",
    classes: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
  },
  awaiting_approval: {
    label: "Awaiting Approval",
    classes: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
  processing: {
    label: "Processing",
    classes: "bg-blue-50 text-blue-700 ring-blue-200",
    dot: "bg-blue-500 animate-pulse",
  },
  completed: {
    label: "Completed",
    classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    classes: "bg-red-50 text-red-700 ring-red-200",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "Cancelled",
    classes: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    dot: "bg-zinc-400",
  },
};

export function PaymentStatusBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  const s = PAYMENT_STATES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${s.classes}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
