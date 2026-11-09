"use client";

import { useEffect, useState } from "react";
import type { Receipt } from "@/lib/receipt/types";
import { usd } from "./Card";

export function ReceiptModal({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/receipts/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          receipt?: Receipt;
          error?: string;
        };

        if (!active) return;

        if (!res.ok || !data.receipt) {
          setError(data.error || "Failed to load receipt.");
          return;
        }

        setReceipt(data.receipt);
      } catch {
        if (active) setError("Could not reach the server to load receipt.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #receipt-modal-print, #receipt-modal-print * {
            visibility: visible !important;
          }
          #receipt-modal-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .receipt-no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Payment Receipt"
      >
        <div
          id="receipt-modal-print"
          className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        >
          {loading && (
            <div className="py-12 text-center text-sm text-slate-500">
              <p>Loading receipt details…</p>
            </div>
          )}

          {error && (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-red-600">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          )}

          {receipt && (
            <div>
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Payment Receipt</h3>
                    <p className="text-xs text-slate-500">PayPal AgentFlow Autonomous Checkout</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    {receipt.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Receipt No:</span>
                  <p className="font-mono font-medium text-slate-800">{receipt.receiptNumber}</p>
                </div>
                <div>
                  <span className="text-slate-400">Payment Environment:</span>
                  <p className="font-medium text-slate-800 capitalize">{receipt.environment}</p>
                </div>
                <div>
                  <span className="text-slate-400">Order Initiated:</span>
                  <p className="font-medium text-slate-800" suppressHydrationWarning>
                    {new Date(receipt.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Payment Completed:</span>
                  <p className="font-medium text-slate-800" suppressHydrationWarning>
                    {new Date(receipt.completedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Payment Method:</span>
                  <p className="font-medium text-slate-800">{receipt.paymentMethod}</p>
                </div>
                <div>
                  <span className="text-slate-400">PayPal Capture ID:</span>
                  <p className="font-mono font-medium text-slate-800 truncate" title={receipt.captureId}>
                    {receipt.captureId}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">PayPal Order ID:</span>
                  <p className="font-mono text-slate-800 truncate">{receipt.orderId}</p>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-xs font-medium text-slate-400">
                  <span>ITEM</span>
                  <span>AMOUNT</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{receipt.item.productName}</p>
                    <p className="text-xs text-slate-500">Merchant: {receipt.item.merchant}</p>
                  </div>
                  <span className="font-semibold text-slate-900">{usd(receipt.amount)}</span>
                </div>
              </div>

              <div className="mt-5 flex items-baseline justify-between border-t border-slate-200 pt-4">
                <span className="text-sm font-semibold text-slate-900">Total Paid</span>
                <span className="text-lg font-bold text-slate-900">
                  {usd(receipt.amount)} <span className="text-xs font-normal text-slate-500">{receipt.currency}</span>
                </span>
              </div>

              {receipt.note && (
                <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                  {receipt.note}
                </p>
              )}

              <div className="receipt-no-print mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
