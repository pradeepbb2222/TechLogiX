
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

const NAV_ITEMS = [
  { label: "Shopping assistant", href: "#shopping-assistant", icon: "✳" },
  { label: "Product discovery", href: "#product-discovery", icon: "⌕" },
  { label: "Transactions", href: "#transactions", icon: "▤" },
  { label: "Spending controls", href: "#spending", icon: "◈" },
  { label: "Payment approval", href: "#payment", icon: "⇄" },
  { label: "Agent activity", href: "#activity", icon: "◷" },
];

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
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col bg-[#111827] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.08] px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-lg font-black text-white">
            A
          </div>
          <div>
            <p className="text-[17px] font-bold tracking-tight">AgentFlow</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Intelligent commerce
            </p>
          </div>
        </div>

        <div className="px-4 pt-8">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Workspace
          </p>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[12px] font-medium transition ${
                  index === 0
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center text-base">
                  {item.icon}
                </span>
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-auto border-t border-white/[0.08] p-4">
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-white/[0.05] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-300">
                Signed in as
              </p>
              <p className="truncate text-[11px] text-white">{userEmail}</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <span className="flex items-center gap-2 text-[10px] font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Sandbox environment
            </span>
          </div>
        </div>
      </aside>

      {/* Main application */}
      <div className="min-h-screen lg:ml-[250px]">
        {/* Top navigation */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[76px] items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-black text-white">
                A
              </div>
              <span className="font-bold tracking-tight">AgentFlow</span>
            </div>

            <div className="hidden lg:block">
              <p className="text-[11px] font-medium text-slate-400">
                WORKSPACE / OVERVIEW
              </p>
              <h1 className="mt-0.5 text-sm font-bold text-slate-900">
                Shopping workspace
              </h1>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-700 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                PAYPAL SANDBOX
              </span>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>

          {/* Mobile navigation */}
          <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-md px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {logoutError && (
            <p role="alert" className="px-8 pb-3 text-xs text-red-600">
              Logout failed: {logoutError}
            </p>
          )}
        </header>

        {/* Workspace content */}
        <main className="mx-auto max-w-[1600px] px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
          {/* Page heading */}
          <section className="mb-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Overview
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-[11px] text-slate-400">
                Shopping workspace
              </span>
            </div>

            <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">
                  Shopping workspace
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
                  Discover products, evaluate recommendations and manage
                  purchases with your AI shopping agent.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Payment approval required
              </div>
            </div>
          </section>

          {/* Main two-column layout */}
          <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-12">
            {/* Shopping area */}
            <div className="min-w-0 space-y-6 2xl:col-span-8">
              <section id="shopping-assistant" className="scroll-mt-28">
                <ChatPanel
                  messages={a.messages}
                  busy={a.isSearching}
                  onSend={a.sendMessage}
                />
              </section>

              <section id="product-discovery" className="scroll-mt-28">
                <ProductComparison
                  products={a.products}
                  recommendedId={a.recommendedId}
                  selectedId={a.selectedId}
                  spendingLimit={a.spendingLimit}
                  onSelect={a.selectProduct}
                />
              </section>

              <section id="transactions" className="scroll-mt-28">
                <TransactionHistory transactions={a.transactions} />
              </section>
            </div>

            {/* Payment management area */}
            <aside className="min-w-0 space-y-6 2xl:col-span-4">
              <section id="spending" className="scroll-mt-28">
                <SpendingLimit
                  limit={a.spendingLimit}
                  spent={a.spent}
                  remaining={a.remaining}
                  onChange={a.setSpendingLimit}
                />
              </section>

              <section id="payment" className="scroll-mt-28">
                <PaymentPanel
                  status={a.paymentStatus}
                  selected={a.selected}
                  message={a.paymentMessage}
                  spendingLimit={a.spendingLimit}
                  onApprove={a.approve}
                  onCancel={a.cancel}
                  onRetry={a.retry}
                />
              </section>

              <section id="activity" className="scroll-mt-28">
                <ActivityTimeline events={a.events} />
              </section>
            </aside>
          </div>

          <footer className="mt-12 border-t border-slate-200 py-6">
            <div className="flex flex-col justify-between gap-2 text-[10px] text-slate-400 sm:flex-row">
              <span>AgentFlow · Intelligent commerce platform</span>
              <span>Secure shopping · User-approved payments</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
