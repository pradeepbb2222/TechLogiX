import type { Transaction } from "@/lib/types";
import { Card, usd } from "./Card";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

export function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card title="Transaction History">
      {transactions.length === 0 ? (
        <p className="text-sm text-slate-500">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Item</th>
                <th className="py-2 pr-4 font-medium">Merchant</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <tr key={t.id} className="align-top">
                  <td className="py-2 pr-4 text-slate-900">
                    {t.productName}
                    {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{t.merchant}</td>
                  <td className="py-2 pr-4 text-slate-900">{usd(t.amount)}</td>
                  <td className="py-2 pr-4"><PaymentStatusBadge status={t.status} /></td>
                  <td className="py-2 text-slate-500" suppressHydrationWarning>{new Date(t.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
