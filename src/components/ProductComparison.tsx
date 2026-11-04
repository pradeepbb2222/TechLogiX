import type { Product } from "@/lib/types";
import { Card } from "./Card";
import { ProductCard } from "./ProductCard";

export function ProductComparison({ products, recommendedId, selectedId, spendingLimit, onSelect }: {
  products: Product[]; recommendedId: string | null; selectedId: string | null; spendingLimit: number; onSelect: (id: string) => void;
}) {
  return (
    <Card title="Product Comparison" action={<span className="text-xs text-slate-400">Live product results</span>}>
      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No products yet. Ask the assistant to find something.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} selected={p.id === selectedId} recommended={p.id === recommendedId} overLimit={p.price > spendingLimit} onSelect={() => onSelect(p.id)} />
          ))}
        </div>
      )}
    </Card>
  );
}
