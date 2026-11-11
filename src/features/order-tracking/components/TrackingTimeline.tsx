import type {
  OrderStatus,
  TrackingEvent,
} from "../types/order.types";

import { STATUS_FLOW } from "../services/orderSimulator";
import { formatTrackingDate } from "../utils/orderHelpers";

interface TrackingTimelineProps {
  currentStatus: OrderStatus;
  events: TrackingEvent[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  ORDER_PLACED: "Order Placed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
};

export function TrackingTimeline({
  currentStatus,
  events,
}: TrackingTimelineProps) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);

  return (
    <div className="space-y-5">
      {STATUS_FLOW.map((status, index) => {
        const completed = index < currentIndex;
        const current = index === currentIndex;

        const event = events.find(
          (item) => item.status === status
        );

        return (
          <div key={status} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                  completed
                    ? "border-green-500 bg-green-500 text-white"
                    : current
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white text-slate-400"
                }`}
              >
                {completed ? "✓" : index + 1}
              </div>

              {index !== STATUS_FLOW.length - 1 && (
                <div
                  className={`mt-1 min-h-10 w-0.5 ${
                    completed
                      ? "bg-green-500"
                      : "bg-slate-200"
                  }`}
                />
              )}
            </div>

            <div className="pb-4">
              <h3
                className={`font-semibold ${
                  current
                    ? "text-blue-700"
                    : completed
                      ? "text-green-700"
                      : "text-slate-400"
                }`}
              >
                {STATUS_LABELS[status]}
                {current && (
                  <span className="ml-2 text-xs font-medium">
                    (Current)
                  </span>
                )}
              </h3>

              {event ? (
                <>
                  <p className="mt-1 text-sm text-slate-600">
                    {event.description}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {formatTrackingDate(event.timestamp)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-400">
                  Awaiting update
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}