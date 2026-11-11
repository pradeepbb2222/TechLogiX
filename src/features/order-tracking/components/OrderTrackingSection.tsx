
"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrackedOrder } from "../types/order.types";
import { OrderTrackingPanel } from "./OrderTrackingPanel";

export function OrderTrackingSection() {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/order-tracking/my-orders", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load tracked orders.");
      }

      setOrders(data.orders ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">
          Loading your tracked orders...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void fetchOrders()}
          className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Try again
        </button>
      </section>
    );
  }

  return <OrderTrackingPanel orders={orders} />;
}
