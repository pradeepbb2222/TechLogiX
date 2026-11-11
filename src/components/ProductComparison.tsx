
import type { Product } from "@/lib/types";
import { Card } from "./Card";
import { ProductCard } from "./ProductCard";

export function ProductComparison({
  products,
  recommendedId,
  selectedId,
  spendingLimit,
  onSelect,
}: {
  products: Product[];
  recommendedId: string | null;
  selectedId: string | null;
  spendingLimit: number;
  onSelect: (id: string) => void;
}) {
  const recommendedProduct = products.find(
    (product) => product.id === recommendedId,
  );

  return (
    <Card
      title="Product discovery"
      action={
        <span className="text-xs font-medium tabular-nums text-slate-500">
          {products.length} {products.length === 1 ? "product" : "products"}
        </span>
      }
    >
      {products.length === 0 ? (
        <div className="flex min-h-[190px] flex-col items-center justify-center border-y border-slate-100 py-8 text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5M8 10h5m-2.5-2.5v5" />
            </svg>
          </div>

          <h3 className="text-sm font-bold text-slate-800">
            No products to display yet
          </h3>

          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
            Start a conversation with your shopping assistant. Matching
            products will appear here for comparison.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Results information */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-bold text-slate-800">
                Matching products
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Review the available options and choose your preferred product.
              </p>
            </div>

            {recommendedProduct && (
              <span className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-700">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z" />
                </svg>
                AI RECOMMENDED
              </span>
            )}
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {products.map((product) => {
              const selected = product.id === selectedId;
              const recommended = product.id === recommendedId;
              const overLimit = product.price > spendingLimit;

              return (
                <div
                  key={product.id}
                  className={`min-w-0 rounded-xl transition ${
                    selected
                      ? "ring-2 ring-blue-500 ring-offset-2"
                      : recommended
                        ? "ring-1 ring-blue-200"
                        : ""
                  }`}
                >
                  <ProductCard
                    product={product}
                    selected={selected}
                    recommended={recommended}
                    overLimit={overLimit}
                    onSelect={() => onSelect(product.id)}
                  />
                </div>
              );
            })}
          </div>

          {/* Selection feedback */}
          {selectedId && (
            <div className="flex items-start gap-3 border-t border-slate-100 pt-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-800">
                  Product selected
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                  Review the payment approval panel to continue. No purchase
                  is made until you explicitly approve it.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
