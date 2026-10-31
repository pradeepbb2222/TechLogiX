import type { PaymentStatus } from "@/lib/types";

export const PAYMENT_STATES: Record<PaymentStatus, { label: string; classes: string; dot: string }> = {
  not_started: { label: "Not Started", classes: "bg-slate-100 text-slate-700 ring-slate-300", dot: "bg-slate-400" },
  awaiting_approval: { label: "Awaiting Approval", classes: "bg-amber-50 text-amber-800 ring-amber-300", dot: "bg-amber-500" },
  processing: { label: "Processing", classes: "bg-blue-50 text-blue-800 ring-blue-300", dot: "bg-blue-500 animate-pulse" },
  completed: { label: "Completed", classes: "bg-emerald-50 text-emerald-800 ring-emerald-300", dot: "bg-emerald-500" },
  failed: { label: "Failed", classes: "bg-red-50 text-red-800 ring-red-300", dot: "bg-red-500" },
  cancelled: { label: "Cancelled", classes: "bg-zinc-100 text-zinc-600 ring-zinc-300", dot: "bg-zinc-400" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${s.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
