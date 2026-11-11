
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrackedOrder } from "../types/order.types";
import { OrderTrackingPanel } from "./OrderTrackingPanel";

const REFRESH_INTERVAL_MS = 60_000;

export function OrderTrackingSection() {
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isFetching = useRef(false);
  const isMounted = useRef(false);

  const fetchOrders = useCallback(async (showLoading = false) => {
    if (isFetching.current) return;

    isFetching.current = true;
    if (showLoading && isMounted.current) {
      setLoading(true);
      setError("");
    }

    try {
      const response = await fetch("/api/order-tracking/my-orders", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load tracked orders.");
      }

      if (isMounted.current) {
        setOrders(data.orders ?? []);
        setError("");
      }
    } catch (err) {
      // Keep current orders visible when a background refresh fails.
      if (showLoading && isMounted.current) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      }
    } finally {
      isFetching.current = false;
      if (showLoading && isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void fetchOrders(true);

    const intervalId = window.setInterval(() => {
      void fetchOrders();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted.current = false;
      window.clearInterval(intervalId);
    };
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

  if (error && orders.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void fetchOrders(true)}
          className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Try again
        </button>
      </section>
    );
  }

  return <OrderTrackingPanel orders={orders} />;
}
