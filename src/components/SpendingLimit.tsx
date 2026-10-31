import { Card, usd } from "./Card";

export function SpendingLimit({ limit, spent, remaining, onChange }: { limit: number; spent: number; remaining: number; onChange: (n: number) => void }) {
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  return (
    <Card title="Spending Limit">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-slate-900">{usd(remaining)}</p>
          <p className="text-xs text-slate-500">remaining of {usd(limit)}</p>
        </div>
        <p className="text-sm text-slate-600">Spent {usd(spent)}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
      <label className="mt-4 block text-xs font-medium text-slate-600" htmlFor="limit">Adjust limit (USD)</label>
      <input
        id="limit"
        type="range"
        min={10}
        max={1000}
        step={10}
        value={limit}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-blue-600"
      />
      <p className="mt-1 text-xs text-slate-400">Purchases above this limit are blocked by the UI and the server.</p>
    </Card>
  );
}
