
import type { PaymentStatus, Product } from "@/lib/types";
import { Card, usd } from "./Card";
import { PAYMENT_STATES, PaymentStatusBadge } from "./PaymentStatusBadge";

const ORDER: PaymentStatus[] = [
  "not_started",
  "awaiting_approval",
  "processing",
  "completed",
  "failed",
  "cancelled",
];

const STATUS_STEPS = [
  { status: "awaiting_approval", label: "Approval" },
  { status: "processing", label: "Processing" },
  { status: "completed", label: "Completed" },
] as const;

export function PaymentPanel({
  status,
  selected,
  message,
  spendingLimit,
  onApprove,
  onCancel,
  onRetry,
}: {
  status: PaymentStatus;
  selected: Product | null;
  message: string | null;
  spendingLimit: number;
  onApprove: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const overLimit = !!selected && selected.price > spendingLimit;

  const currentStep =
    status === "awaiting_approval"
      ? 0
      : status === "processing"
        ? 1
        : status === "completed"
          ? 2
          : -1;

  const statusDescriptions: Record<PaymentStatus, string> = {
    not_started: "Choose a product to begin the payment process.",
    awaiting_approval: "Review your purchase before authorizing payment.",
    processing: "Your payment is being processed.",
    completed: "Your payment has been completed successfully.",
    failed: "Your payment could not be completed.",
    cancelled: "This payment attempt has been cancelled.",
  };

  return (
    <Card
      title="Payment authorization"
      action={<PaymentStatusBadge status={status} />}
    >
      {/* Payment status */}
      <div className="border-b border-slate-100 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Current payment status
        </p>

        <p className="mt-2 text-sm font-bold text-slate-900">
          {statusDescriptions[status]}
        </p>
      </div>

      {/* Selected product */}
      {selected ? (
        <div className="py-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Purchase details
          </p>

          <div className="flex items-start gap-3">
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
              {selected.imageUrl ? (
                <img
                  src={selected.imageUrl}
                  alt={selected.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-7 w-7 text-slate-300"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="9" r="1.5" />
                  <path d="m21 15-5-5L5 20" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-xs font-bold leading-5 text-slate-900">
                {selected.name}
              </h3>

              <p className="mt-1 truncate text-[10px] text-slate-500">
                Sold by {selected.merchant}
              </p>

              <p className="mt-2 text-base font-bold text-slate-950">
                {usd(selected.price)}
              </p>
            </div>
          </div>

          {/* Amount breakdown */}
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Product amount</span>
              <span className="font-semibold text-slate-700">
                {usd(selected.price)}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-bold text-slate-900">
                Total amount
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-950">
                {usd(selected.price)}
              </span>
            </div>

            <p className="text-[9px] leading-4 text-slate-400">
              Displayed total reflects the product price available to AgentFlow.
              Additional merchant charges, if any, are not included.
            </p>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M3 7h18v12H3z" />
              <path d="M3 10h18M7 15h4" />
            </svg>
          </div>

          <p className="mt-3 text-xs font-bold text-slate-800">
            No product selected
          </p>

          <p className="mx-auto mt-1 max-w-[230px] text-[11px] leading-5 text-slate-500">
            Select a product from your recommendations to review its payment.
          </p>
        </div>
      )}

      {/* Spending limit warning */}
      {overLimit && (
        <div
          className="mb-4 border border-red-200 bg-red-50 p-3"
          role="alert"
        >
          <p className="text-xs font-bold text-red-800">
            Spending limit exceeded
          </p>

          <p className="mt-1 text-[11px] leading-5 text-red-700">
            This product costs {usd(selected.price - spendingLimit)} more than
            your configured spending limit. Payment approval is disabled.
          </p>
        </div>
      )}

      {/* Payment progress */}
      {status !== "not_started" && (
        <div className="border-t border-slate-100 py-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Payment progress
          </p>

          <div className="grid grid-cols-3 gap-2">
            {STATUS_STEPS.map((step, index) => {
              const complete = currentStep >= index;
              const active = currentStep === index;

              return (
                <div key={step.status} className="min-w-0 text-center">
                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      complete
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-400"
                    } ${active ? "ring-4 ring-blue-100" : ""}`}
                  >
                    {currentStep > index ? "✓" : index + 1}
                  </div>

                  <p
                    className={`mt-2 text-[10px] font-semibold ${
                      complete ? "text-blue-700" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Server response */}
      {message && (
        <div
          className={`mb-4 border p-3 ${
            status === "failed"
              ? "border-red-100 bg-red-50 text-red-800"
              : status === "completed"
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
          role="status"
        >
          <p className="text-xs leading-5">{message}</p>
        </div>
      )}

      {/* Payment actions */}
      <div className="space-y-2 border-t border-slate-100 pt-5">
        {status === "awaiting_approval" && (
          <>
            <button
              type="button"
              onClick={onApprove}
              disabled={overLimit || !selected}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true">✓</span>
              Approve payment
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              Cancel purchase
            </button>
          </>
        )}

        {status === "processing" && (
          <div className="flex items-center justify-center gap-2 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
            Waiting for payment confirmation...
          </div>
        )}

        {(status === "failed" || status === "cancelled") && selected && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-lg bg-[#172554] px-4 py-3 text-xs font-bold text-white transition hover:bg-blue-700"
          >
            Review purchase again
          </button>
        )}
      </div>

      {/* Security notice */}
      <div className="mt-5 flex items-start gap-2.5 border-t border-slate-100 pt-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
          aria-hidden="true"
        >
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
        </svg>

        <p className="text-[10px] leading-5 text-slate-500">
          Your purchase requires your explicit approval. AgentFlow does not
          authorize payments automatically.
        </p>
      </div>

      {/* Existing payment state reference */}
      <div className="sr-only" aria-label="Payment states">
        {ORDER.map((state) => (
          <span key={state}>{PAYMENT_STATES[state].label}</span>
        ))}
      </div>
    </Card>
  );
}
