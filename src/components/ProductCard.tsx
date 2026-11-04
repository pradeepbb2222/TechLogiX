
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
    verified: "bg-green-100 text-green-700",
    unknown: "bg-amber-100 text-amber-700",
    mismatch: "bg-red-100 text-red-700",
  };

  const statusLabel = {
    verified: "Verified",
    unknown: "Unknown",
    mismatch: "Mismatch",
  };

  return (
    <article
      className={`flex flex-col rounded-xl border p-4 transition ${
        selected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-slate-200"
      }`}
    >
      {product.imageUrl && (
        <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-contain"
          />
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {product.name}
        </h3>

        {recommended && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            Top pick
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500">{product.merchant}</p>

      <p className="mt-2 text-xl font-bold text-slate-900">
        {usd(product.price)}
      </p>

      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <dt className="text-slate-400">Rating</dt>
          <dd>
            {product.rating != null
              ? `★ ${product.rating.toFixed(1)} / 5`
              : "N/A"}
          </dd>
        </div>

        <div>
          <dt className="text-slate-400">Reviews</dt>
          <dd>
            {product.reviews != null
              ? product.reviews.toLocaleString()
              : "N/A"}
          </dd>
        </div>
      </dl>

      {product.highlights.length > 0 && (
        <ul className="mt-3 flex-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
          {product.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}

      {product.score !== undefined && (
        <p className="mt-3 text-xs text-slate-500">
          AI ranking score:{" "}
          <span className="font-medium text-slate-800">
            {product.score}/100
          </span>
        </p>
      )}

      {evidenceProduct.aiReason && (
        <div className="mt-3 rounded-lg bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-900">
            Reasoning
          </p>
          <p className="mt-1 text-xs leading-relaxed text-blue-800">
            {evidenceProduct.aiReason}
          </p>
        </div>
      )}

      {evidenceProduct.requirements &&
        evidenceProduct.requirements.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold text-slate-800">
              Requirement analysis
            </p>

            <div className="space-y-2">
              {evidenceProduct.requirements.map((item, index) => (
                <div key={`${item.requirement}-${index}`}>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-medium text-slate-700">
                      {item.requirement}
                    </span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        statusStyle[item.status]
                      }`}
                    >
                      {statusLabel[item.status]}
                    </span>
                  </div>

                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    {item.evidence}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      {overLimit && (
        <p className="mt-3 text-xs font-medium text-red-600">
          Exceeds spending limit
        </p>
      )}

      <a
        href={product.productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 text-center text-xs font-medium text-blue-600 hover:underline"
      >
        View on merchant website ↗
      </a>

      <button
        type="button"
        onClick={onSelect}
        disabled={selected}
        className="mt-3 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:bg-blue-600 disabled:text-white"
      >
        {selected ? "Selected" : "Select"}
      </button>
    </article>
  );
}
