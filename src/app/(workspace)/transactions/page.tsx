
"use client";

import { TransactionHistory } from "@/components/TransactionHistory";
import { useAgentFlowContext } from "@/providers/AgentFlowProvider";

export default function TransactionsPage() {
  const { flow } = useAgentFlowContext();

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
          Workspace / Transactions
        </p>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
          Transaction History
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Review your purchases and track their payment statuses.
        </p>
      </section>

      <TransactionHistory transactions={flow.transactions} />
    </div>
  );
}
