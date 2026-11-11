import type { TrackedOrder } from "../types/order.types";
import {
  formatOrderStatus,
  formatTrackingDate,
} from "../utils/orderHelpers";
import { TrackingTimeline } from "./TrackingTimeline";

interface OrderTrackingCardProps {
  order: TrackedOrder;
}

export function OrderTrackingCard({
  order,
}: OrderTrackingCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {order.productName}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Sold by {order.merchant}
          </p>
        </div>

        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          {formatOrderStatus(order.status)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">
            Tracking Number
          </p>
          <p className="mt-1 font-semibold text-slate-800">
            {order.trackingNumber}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">
            Estimated Delivery
          </p>
          <p className="mt-1 font-semibold text-slate-800">
            {formatTrackingDate(order.estimatedDelivery)}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">
            Order ID
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {order.orderId}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">
            Last Updated
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {formatTrackingDate(order.updatedAt)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-4 font-semibold text-slate-900">
          Delivery Progress
        </h3>

        <TrackingTimeline
          currentStatus={order.status}
          events={order.events}
        />
      </div>

      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Demo tracking: delivery updates are simulated and are not
        connected to a real courier.
      </p>
    </div>
  );
}