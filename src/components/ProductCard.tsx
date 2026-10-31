import type { Product } from "@/lib/types";
import { usd } from "./Card";

export function ProductCard({ product, selected, recommended, overLimit, onSelect }: {
  product: Product; selected: boolean; recommended: boolean; overLimit: boolean; onSelect: () => void;
}) {
  return (
    <article className={`flex flex-col rounded-xl border p-4 transition ${selected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{product.name}</h3>
        {recommended && <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">Top pick</span>}
      </div>
      <p className="text-xs text-slate-500">{product.merchant}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{usd(product.price)}</p>
      <dl className="mt-2 grid grid-cols-3 gap-1 text-xs text-slate-600">
        <div><dt className="text-slate-400">Rating</dt><dd>★ {product.rating}</dd></div>
        <div><dt className="text-slate-400">Reviews</dt><dd>{product.reviews.toLocaleString()}</dd></div>
        <div><dt className="text-slate-400">Delivery</dt><dd>{product.deliveryDays}d</dd></div>
      </dl>
      <ul className="mt-3 flex-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
        {product.highlights.map((h) => <li key={h}>{h}</li>)}
      </ul>
      {product.score !== undefined && <p className="mt-3 text-xs text-slate-500">Agent score: <span className="font-medium text-slate-800">{product.score}/100</span></p>}
      {overLimit && <p className="mt-1 text-xs font-medium text-red-600">Exceeds spending limit</p>}
      <button type="button" onClick={onSelect} disabled={selected} className="mt-3 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:bg-blue-600 disabled:text-white">
        {selected ? "Selected" : "Select"}
      </button>
    </article>
  );
}
