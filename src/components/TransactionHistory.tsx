
import type { Transaction } from "@/lib/types";
import { Card, usd } from "./Card";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

export function TransactionHistory({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <Card
      title="Transaction history"
      action={
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
          {transactions.length} records
        </span>
      }
    >
      {transactions.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl text-slate-400 shadow-sm ring-1 ring-slate-200">
            ↗
          </div>

          <h3 className="mt-4 text-sm font-bold text-slate-800">
            No transactions yet
          </h3>

          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
            Your purchase and payment activity will appear here once you
            start shopping with AgentFlow.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-4">Product</th>
                  <th className="px-4 py-4">Merchant</th>
                  <th className="px-4 py-4">Amount</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Date & time</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="transition hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-4">
                      <p className="max-w-[220px] text-xs font-bold leading-5 text-slate-800">
                        {t.productName}
                      </p>

                      {t.note && (
                        <p className="mt-1 max-w-[220px] text-[11px] leading-4 text-slate-400">
                          {t.note}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4 text-xs font-medium text-slate-600">
                      {t.merchant}
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-sm font-bold text-slate-900">
                        {usd(t.amount)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <PaymentStatusBadge status={t.status} />
                    </td>

                    <td
                      className="px-4 py-4 text-xs leading-5 text-slate-500"
                      suppressHydrationWarning
                    >
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
