import type { PaymentStatus, Product } from "@/lib/types";
import { Card, usd } from "./Card";
import { PAYMENT_STATES, PaymentStatusBadge } from "./PaymentStatusBadge";

const ORDER: PaymentStatus[] = ["not_started", "awaiting_approval", "processing", "completed", "failed", "cancelled"];

export function PaymentPanel({ status, selected, message, spendingLimit, onApprove, onCancel, onRetry }: {
  status: PaymentStatus; selected: Product | null; message: string | null; spendingLimit: number;
  onApprove: () => void; onCancel: () => void; onRetry: () => void;
}) {
  const overLimit = !!selected && selected.price > spendingLimit;
  return (
    <Card title="Payment" action={<PaymentStatusBadge status={status} />}>
      {selected ? (
        <p className="text-sm text-slate-700">
          {selected.name} · <span className="font-semibold">{usd(selected.price)}</span> from {selected.merchant}
        </p>
      ) : (
        <p className="text-sm text-slate-500">Select a product to review payment.</p>
      )}
      {message && (
        <p className={`mt-3 rounded-lg p-3 text-sm ${status === "failed" ? "bg-red-50 text-red-800" : "bg-slate-50 text-slate-700"}`} role="status">
          {message}
        </p>
      )}
      {overLimit && status === "awaiting_approval" && <p className="mt-3 text-sm text-red-600">This item is above your spending limit.</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {status === "awaiting_approval" && (
          <>
            <button type="button" onClick={onApprove} disabled={overLimit} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              Approve payment
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </>
        )}
        {status === "processing" && <p className="text-sm text-blue-700">Waiting for the payment service…</p>}
        {(status === "failed" || status === "cancelled") && selected && (
          <button type="button" onClick={onRetry} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Review again
          </button>
        )}
      </div>
      <ol className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400" aria-label="Payment states">
        {ORDER.map((s) => (
          <li key={s} className={s === status ? "font-semibold text-slate-800" : ""}>{PAYMENT_STATES[s].label}</li>
        ))}
      </ol>
    </Card>
  );
}
