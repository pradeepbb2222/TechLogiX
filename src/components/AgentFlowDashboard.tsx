
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ChatPanel } from "@/components/ChatPanel";
import { PaymentPanel } from "@/components/PaymentPanel";
import { ProductComparison } from "@/components/ProductComparison";
import { SpendingLimit } from "@/components/SpendingLimit";
import { TransactionHistory } from "@/components/TransactionHistory";
import { useAgentFlow } from "@/hooks/useAgentFlow";

interface Props {
  userEmail: string;
}

export default function AgentFlowDashboard({ userEmail }: Props) {
  const a = useAgentFlow();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setLogoutError(error.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              PayPal AgentFlow
            </h1>
            <p className="text-sm text-slate-500">
              Autonomous shopping agent · you approve every payment
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Signed in as: {userEmail}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300 sm:inline">
              PayPal Sandbox
            </span>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>

        {logoutError && (
          <p className="mx-auto max-w-7xl px-4 pb-3 text-sm text-red-600 sm:px-6">
            Logout failed: {logoutError}
          </p>
        )}
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ChatPanel
            messages={a.messages}
            busy={a.isSearching}
            onSend={a.sendMessage}
          />

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
          <SpendingLimit
            limit={a.spendingLimit}
            spent={a.spent}
            remaining={a.remaining}
            onChange={a.setSpendingLimit}
          />

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
