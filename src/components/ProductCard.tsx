
import type { Product } from "@/lib/types";
import { usd } from "./Card";

type RequirementEvidence = {
  requirement: string;
  status: "verified" | "unknown" | "mismatch";
  evidence: string;
};

type ProductWithEvidence = Product & {
  aiReason?: string;
  requirements?: RequirementEvidence[];
};

export function ProductCard({
  product,
  selected,
  recommended,
  overLimit,
  onSelect,
}: {
  product: Product;
  selected: boolean;
  recommended: boolean;
  overLimit: boolean;
  onSelect: () => void;
}) {
  const evidenceProduct = product as ProductWithEvidence;

  const statusStyle = {
    verified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    unknown: "bg-amber-50 text-amber-700 ring-amber-200",
    mismatch: "bg-red-50 text-red-700 ring-red-200",
  };

  const statusLabel = {
    verified: "Verified",
    unknown: "Unverified",
    mismatch: "Mismatch",
  };

  return (
    <article
      className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition-colors duration-200 ${
        selected
          ? "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.12)]"
          : recommended
            ? "border-blue-200"
            : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Product image */}
      <div className="relative flex h-44 items-center justify-center overflow-hidden border-b border-slate-100 bg-[#f8fafc] p-5">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-slate-400 ring-1 ring-slate-200">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="9" cy="9" r="1.5" />
              <path d="m21 15-5-5L5 20" />
            </svg>
          </div>
        )}

        {recommended && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-[#172554] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
            <span aria-hidden="true">✦</span>
            AI recommended
          </span>
        )}

        {selected && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
            ✓
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Merchant */}
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {product.merchant}
        </p>

        {/* Product name */}
        <h3 className="min-h-10 text-[13px] font-bold leading-5 text-slate-900">
          {product.name}
        </h3>

        {/* Price and rating */}
        <div className="mt-4 flex items-end justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Current price
            </p>
            <p className="mt-1 text-[23px] font-bold tracking-tight text-slate-950">
              {usd(product.price)}
            </p>
          </div>

          {product.rating != null && (
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold text-slate-800">
                <span className="text-amber-500">★</span>{" "}
                {product.rating.toFixed(1)}
              </p>
              <p className="mt-1 text-[9px] text-slate-400">
                {product.reviews != null
                  ? `${product.reviews.toLocaleString()} reviews`
                  : "Rating"}
              </p>
            </div>
          )}
        </div>

        {/* Product highlights */}
        {product.highlights.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Key highlights
            </p>

            <ul className="space-y-2">
              {product.highlights.slice(0, 3).map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-2 text-[11px] leading-5 text-slate-600"
                >
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  <span className="line-clamp-2">{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI match score */}
        {product.score !== undefined && (
          <div className="mt-4 flex items-center justify-between border-y border-slate-100 py-3">
            <div>
              <p className="text-[10px] font-bold text-slate-700">
                {evidenceProduct.aiReason?.startsWith("Automatic fallback:")
                  ? "Match score"
                  : "AI match score"}
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                Based on your shopping requirements
              </p>
            </div>

            <span className="text-lg font-bold tabular-nums text-blue-700">
              {product.score}
              <span className="text-[10px] font-semibold text-slate-400">
                /100
              </span>
            </span>
          </div>
        )}

        {/* AI explanation */}
        {evidenceProduct.aiReason && (
          <div className="mt-3 rounded-lg bg-blue-50/70 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-blue-800">
              Recommendation reasoning
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-700">
              {evidenceProduct.aiReason}
            </p>
          </div>
        )}

        {/* Specification evidence */}
        {evidenceProduct.requirements &&
          evidenceProduct.requirements.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Requirement verification
              </p>

              <div className="space-y-3">
                {evidenceProduct.requirements.map((item, index) => (
                  <div key={`${item.requirement}-${index}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-700">
                        {item.requirement}
                      </span>

                      <span
                        className={`rounded-md px-2 py-1 text-[9px] font-bold ring-1 ring-inset ${
                          statusStyle[item.status]
                        }`}
                      >
                        {statusLabel[item.status]}
                      </span>
                    </div>

                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      {item.evidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Spending limit warning */}
        {overLimit && (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3">
            <div className="flex items-start gap-2">
              <span className="font-bold text-red-600">!</span>
              <p className="text-[10px] leading-5 text-red-700">
                This product exceeds your configured spending limit.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto space-y-2 pt-5">
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            View merchant offer
            <span aria-hidden="true">↗</span>
          </a>

          <button
            type="button"
            onClick={onSelect}
            disabled={selected}
            className={`w-full rounded-lg px-3 py-3 text-xs font-bold transition ${
              selected
                ? "cursor-default bg-emerald-600 text-white"
                : "bg-[#172554] text-white hover:bg-blue-700"
            }`}
          >
            {selected ? "✓ Product selected" : "Select product"}
          </button>
        </div>
      </div>
    </article>
  );
}
