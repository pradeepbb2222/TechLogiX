"use client";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ChatPanel } from "@/components/ChatPanel";
import { PaymentPanel } from "@/components/PaymentPanel";
import { ProductComparison } from "@/components/ProductComparison";
import { SpendingLimit } from "@/components/SpendingLimit";
import { TransactionHistory } from "@/components/TransactionHistory";
import { useAgentFlow } from "@/hooks/useAgentFlow";

export default function Home() {
  const a = useAgentFlow();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">PayPal AgentFlow</h1>
            <p className="text-sm text-slate-500">Autonomous shopping agent · you approve every payment</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300">
  PayPal Sandbox
</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ChatPanel messages={a.messages} busy={a.isSearching} onSend={a.sendMessage} />
          <ProductComparison
            products={a.products}
            recommendedId={a.recommendedId}
            selectedId={a.selectedId}
            spendingLimit={a.spendingLimit}
            onSelect={a.selectProduct}
          />
          <TransactionHistory transactions={a.transactions} />
        </div>
        <div className="space-y-6">
          <SpendingLimit limit={a.spendingLimit} spent={a.spent} remaining={a.remaining} onChange={a.setSpendingLimit} />
          <PaymentPanel
            status={a.paymentStatus}
            selected={a.selected}
            message={a.paymentMessage}
            spendingLimit={a.spendingLimit}
            onApprove={a.approve}
            onCancel={a.cancel}
            onRetry={a.retry}
          />
          <ActivityTimeline events={a.events} />
        </div>
      </main>
    </div>
  );
}
