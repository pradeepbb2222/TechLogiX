
"use client";

import Link from "next/link";
import { useAgentFlowContext } from "@/providers/AgentFlowProvider";
import { PriceHistoryPanel } from "@/components/PriceHistoryPanel";
export default function CheckoutPage() {
  const { flow } = useAgentFlowContext();
  const selected = flow.selected;

  if (!selected) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">
          No product selected
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Choose a product before proceeding to checkout.
        </p>
        <Link
          href="/results"
          className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const exceedsLimit = selected.price > flow.remaining;
  const remainingAfterPurchase = Math.max(
    0,
    flow.remaining - selected.price
  );

  const money = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <section>
        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
          Shopping / Checkout
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
          Review your purchase
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Check the product and budget details before continuing to PayPal.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4">
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
      Order summary
    </p>
  </div>

  <div className="p-6">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400">
          SELECTED PRODUCT
        </p>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
          {selected.name}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Review your selection before authorizing payment.
        </p>
      </div>

      <div className="shrink-0 rounded-xl bg-indigo-50 px-5 py-4 sm:min-w-[160px] sm:text-right">
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
          Product price
        </p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-indigo-700">
          {money(selected.price)}
        </p>
      </div>
    </div>

    <div className="mt-6 border-t border-slate-100 pt-4">
      <Link
        href="/results"
        className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800"
      >
        <span aria-hidden="true">←</span>
        Change selected product
      </Link>
    </div>
  </div>
</section>
<PriceHistoryPanel selected={selected} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
        Budget control
      </p>
      <h3 className="mt-1 text-lg font-bold text-slate-950">
        Spending overview
      </h3>
    </div>
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
      Spending limit active
    </span>
  </div>

  <div className="mt-6 grid gap-3 sm:grid-cols-2">
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">
        Your spending limit
      </p>
      <p className="mt-2 text-xl font-bold text-slate-900">
        {money(flow.spendingLimit)}
      </p>
    </div>

    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">
        Already spent
      </p>
      <p className="mt-2 text-xl font-bold text-slate-900">
        {money(flow.spent)}
      </p>
    </div>
  </div>

  <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-5">
    <p className="text-xs font-semibold text-indigo-700">
      AVAILABLE BEFORE PURCHASE
    </p>
    <p className="mt-2 text-3xl font-extrabold tracking-tight text-indigo-800">
      {money(flow.remaining)}
    </p>

    <div className="mt-4 flex items-center justify-between border-t border-indigo-200/70 pt-4">
      <span className="text-sm font-medium text-slate-600">
        After this purchase
      </span>
      <span className={`text-lg font-bold ${
        exceedsLimit ? "text-red-600" : "text-slate-950"
      }`}>
        {money(remainingAfterPurchase)}
      </span>
    </div>
  </div>

  {exceedsLimit && (
    <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
      This product exceeds your remaining spending limit. Choose a cheaper
      product or adjust your spending settings.
    </p>
  )}
</section>

      {flow.paymentMessage && (
        <p
          role="status"
          className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700"
        >
          {flow.paymentMessage}
        </p>
      )}

      <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-6">
        <h3 className="font-bold text-slate-900">
          Ready to continue?
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          CogniCart will create a PayPal Sandbox order. You will be redirected
          to PayPal, where you must approve the payment yourself.
        </p>

        <button
          type="button"
          onClick={() => void flow.approve()}
          disabled={
            exceedsLimit ||
            flow.paymentStatus !== "awaiting_approval"
          }
          className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {flow.paymentStatus === "processing"
            ? "Preparing PayPal checkout..."
            : "Proceed to PayPal"}
        </button>

        <p className="mt-3 text-center text-xs text-slate-500">
          No payment is made until you approve it on PayPal.
        </p>
      </section>
    </div>
  );
}
