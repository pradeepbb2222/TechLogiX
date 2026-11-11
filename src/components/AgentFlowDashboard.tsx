
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { useAgentFlowContext } from "@/providers/AgentFlowProvider";
import { OrderTrackingSection } from "@/features/order-tracking/components/OrderTrackingSection";

export default function AgentFlowDashboard() {
  const { flow, userEmail } = useAgentFlowContext();
  const router = useRouter();
  const previousSearching = useRef(false);

  useEffect(() => {
    if (
      previousSearching.current &&
      !flow.isSearching &&
      flow.products.length > 0
    ) {
      router.push("/results");
    }

    previousSearching.current = flow.isSearching;
  }, [flow.isSearching, flow.products.length, router]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50/80 p-6 shadow-sm sm:p-8">
        <div className="relative z-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
              Your intelligent shopping workspace
            </span>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            Shop smarter with{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
              CogniCart AI
            </span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Tell us what you need. Discover real products, compare suitable
            options and stay in control of every purchase with user-approved
            payments.
          </p>
        </div>

        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-indigo-100/50 blur-3xl" />
      </section>

      <ChatPanel
        messages={flow.messages}
        busy={flow.isSearching}
        onSend={flow.sendMessage}
        userInitial={userEmail?.charAt(0).toUpperCase() || "U"}
      />

      <OrderTrackingSection />
    </div>
  );
}
