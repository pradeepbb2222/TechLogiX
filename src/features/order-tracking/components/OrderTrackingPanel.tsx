import type { TrackedOrder } from "../types/order.types";
import { OrderTrackingCard } from "./OrderTrackingCard";

interface OrderTrackingPanelProps {
  orders: TrackedOrder[];
}

export function OrderTrackingPanel({
  orders,
}: OrderTrackingPanelProps) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Order Tracking
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Track your purchases and check their delivery progress.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="font-semibold text-slate-800">
            No orders to track yet
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Your tracked orders will appear here after a successful payment.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <OrderTrackingCard
              key={order.orderId}
              order={order}
            />
          ))}
        </div>
      )}
    </section>
  );
}