
"use client";

import { useEffect, useState } from "react";
import { useAgentFlowContext } from "@/providers/AgentFlowProvider";

export default function SettingsPage() {
  const { flow } = useAgentFlowContext();

  const [draftLimit, setDraftLimit] = useState(flow.spendingLimit);
  useEffect(() => {
    if (!flow.isLimitLoading) {
        setDraftLimit(flow.spendingLimit);
    }
}, [flow.spendingLimit, flow.isLimitLoading]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account preferences and spending limit.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Spending Limit
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Set the maximum amount you allow CogniCart to spend.
        </p>

        <div className="mt-5">
          <label
            htmlFor="spending-limit"
            className="block text-sm font-medium text-slate-700"
          >
            Maximum spending amount (USD)
          </label>

          <input
            id="spending-limit"
            type="number"
            min="1"
            max="1000"
            step="1"
            value={draftLimit}
            disabled={flow.isLimitLoading || flow.isLimitSaving}
            onChange={(e) => setDraftLimit(Number(e.target.value))}
            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
          />

          <p className="mt-2 text-xs text-slate-500">
            Minimum: $1 · Maximum: $1,000
          </p>
        </div>

        <button
          type="button"
          onClick={() => flow.saveSpendingLimit(draftLimit)}
          disabled={
            flow.isLimitLoading ||
            flow.isLimitSaving ||
            draftLimit < 1 ||
            draftLimit > 1000
          }
          className="mt-5 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {flow.isLimitSaving ? "Saving..." : "Save Spending Limit"}
        </button>
                {flow.limitSuccess && (
          <p className="mt-3 text-sm text-green-600">
            {flow.limitSuccess}
          </p>
        )}

        {flow.limitError && (
          <p className="mt-3 text-sm text-red-600">
            {flow.limitError}
          </p>
        )}
      </section>

    </div>
  );
}
