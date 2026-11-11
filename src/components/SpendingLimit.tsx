
"use client";

import { Card, usd } from "./Card";

export function SpendingLimit({
  limit,
  spent,
  remaining,
  onChange,
}: {
  limit: number;
  spent: number;
  remaining: number;
  onChange: (n: number) => void;
}) {
  const pct =
    limit > 0 ? Math.min(100, Math.max(0, (spent / limit) * 100)) : 0;

  const budgetStatus =
    pct >= 100
      ? "Budget exhausted"
      : pct >= 80
        ? "Near spending limit"
        : "Within budget";

  const progressColor =
    pct >= 100
      ? "bg-red-500"
      : pct >= 80
        ? "bg-amber-500"
        : "bg-blue-600";

  const statusColor =
    pct >= 100
      ? "border-red-200 bg-red-50 text-red-700"
      : pct >= 80
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <Card title="Spending controls">
      {/* Available budget */}
      <div className="border-b border-slate-100 pb-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-slate-500">
            Available budget
          </p>

          <span
            className={`rounded-md border px-2 py-1 text-[9px] font-bold ${statusColor}`}
          >
            {budgetStatus}
          </span>
        </div>

        <p className="mt-3 text-[30px] font-bold tracking-tight text-slate-950">
          {usd(Math.max(0, remaining))}
        </p>

        <p className="mt-1 text-[11px] text-slate-400">
          Remaining from your configured budget
        </p>
      </div>

      {/* Budget utilization */}
      <div className="py-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-800">
              Budget utilization
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Your spending against the configured limit
            </p>
          </div>

          <span className="text-lg font-bold tabular-nums text-slate-900">
            {Math.round(pct)}%
          </span>
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Budget utilization"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Total spent
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {usd(spent)}
            </p>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Spending limit
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {usd(limit)}
            </p>
          </div>
        </div>
      </div>

      {/* Spending limit adjustment */}
      <div className="border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="limit"
            className="text-xs font-bold text-slate-800"
          >
            Configure spending limit
          </label>

          <span className="text-sm font-bold text-blue-700">
            {usd(limit)}
          </span>
        </div>

        <input
          id="limit"
          type="range"
          min={10}
          max={1000}
          step={10}
          value={limit}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-5 w-full cursor-pointer accent-blue-600"
        />

        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>$10</span>
          <span>$1,000</span>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-slate-50 p-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5m0-8h.01" />
          </svg>

          <p className="text-[10px] leading-5 text-slate-500">
            Purchases exceeding your spending limit are subject to
            server-side enforcement.
          </p>
        </div>
      </div>
    </Card>
  );
}
