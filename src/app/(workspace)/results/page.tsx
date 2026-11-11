
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductComparison } from "@/components/ProductComparison";
import { useAgentFlowContext } from "@/providers/AgentFlowProvider";

export default function ResultsPage() {
  const router = useRouter();
  const { flow } = useAgentFlowContext();

  useEffect(() => {
    if (flow.products.length === 0 && !flow.isSearching) {
      router.replace("/");
    }
  }, [flow.products.length, flow.isSearching, router]);

  if (flow.products.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Loading product results...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
          Shopping / Product discovery
        </p>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
          Compare your options
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Review the products retrieved for your request. Select one product
          to continue to its checkout summary.
        </p>
      </section>

      <ProductComparison
        products={flow.products}
        recommendedId={flow.recommendedId}
        selectedId={flow.selectedId}
        spendingLimit={flow.spendingLimit}
        onSelect={flow.selectProduct}
      />

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!flow.selected}
          onClick={() => router.push("/checkout")}
          className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review selected product →
        </button>
      </div>
    </div>
  );
}
