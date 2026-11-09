"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHECKOUT_CONTEXT_KEY } from "@/lib/checkout-context";
import type { PaymentResponse, PaymentStatus, Transaction } from "@/lib/types";
import { Card, usd } from "./Card";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { ReceiptModal } from "./ReceiptModal";

type Mode = "return" | "cancel";
interface Result extends Partial<PaymentResponse> {
  transaction?: Transaction;
  /** True when the server could not give us a payment status (unknown order, expired session, network). */
  unavailable?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Title and fallback text always come from the real backend status, never from the URL the user arrived on. */
const COPY: Record<PaymentStatus, { title: string; fallback: string }> = {
  not_started: { title: "Payment not started", fallback: "No payment has been started." },
  awaiting_approval: { title: "Payment not approved yet", fallback: "The PayPal approval was not completed. Nothing was charged." },
  processing: { title: "Payment is being verified", fallback: "Your payment is being verified with PayPal. Do not pay again; check back shortly." },
  completed: { title: "Payment completed", fallback: "Your payment was captured and verified." },
  failed: { title: "Payment failed", fallback: "The payment did not complete." },
  cancelled: { title: "Payment cancelled", fallback: "This checkout was cancelled. Nothing was charged." },
};

/** Landing page content after PayPal redirects back. Status always comes from the server. */
export function PaymentResult({ mode }: { mode: Mode }) {
  const orderId = useSearchParams().get("token");
  const started = useRef(false);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [showReceipt, setShowReceipt] = useState(false);
  const [result, setResult] = useState<Result>(() =>
    orderId ? {} : { unavailable: true, message: "Missing PayPal order reference." },
  );

  useEffect(() => {
    if (!orderId || started.current) return;
    started.current = true;
    (async () => {
      const endpoint = mode === "return" ? "/api/paypal/capture" : "/api/paypal/cancel";
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });
          const data = (await res.json()) as Result;
          // Another request may be mid-capture; wait for it to settle.
          if (res.ok && data.status === "processing" && attempt < 5) {
            await sleep(1500);
            continue;
          }
          if (data.status === "completed") {
            try {
              sessionStorage.removeItem(CHECKOUT_CONTEXT_KEY); // nothing left to retry
            } catch {
              // ignore
            }
          }
          setResult(res.ok || res.status === 202 ? data : { unavailable: true, message: data.message });
          break;
        } catch {
          setResult({ unavailable: true, message: "Could not reach the server. Check Transaction History before retrying." });
          break;
        }
      }
      setLoading(false);
    })();
  }, [mode, orderId]);

  const status = result.status;
  const known = !result.unavailable && status !== undefined;
  const copy = known ? COPY[status] : null;
  const title = loading ? "Checking payment status…" : (copy?.title ?? "Payment status unavailable");
  const message = loading
    ? "Contacting the server. Please wait."
    : (result.message || copy?.fallback || "We could not load this payment.");
  const tx = result.transaction;
  const canRetry = !loading && known && (status === "cancelled" || status === "failed" || status === "awaiting_approval");

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Card title={title} action={!loading && known ? <PaymentStatusBadge status={status} /> : undefined}>
        <p className="text-sm text-slate-700" role="status">{message}</p>
        {tx && !loading && (
          <p className="mt-3 text-sm text-slate-600">
            {tx.productName} · <span className="font-semibold">{usd(tx.amount)}</span> {tx.currency}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {!loading && known && status === "completed" && orderId && (
            <button
              type="button"
              onClick={() => setShowReceipt(true)}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              View Receipt
            </button>
          )}
          {canRetry && (
            <Link href="/" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Try again (starts a fresh checkout)
            </Link>
          )}
          <Link href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to dashboard
          </Link>
        </div>
      </Card>
      {showReceipt && orderId && (
        <ReceiptModal orderId={orderId} onClose={() => setShowReceipt(false)} />
      )}
    </main>
  );
}
