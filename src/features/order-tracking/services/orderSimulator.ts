import type { OrderStatus, TrackingEvent } from "../types/order.types";

// Order delivery stages in sequence
export const STATUS_FLOW: OrderStatus[] = [
  "ORDER_PLACED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

// Details displayed for each delivery stage
const STATUS_DETAILS: Record<
  OrderStatus,
  { title: string; description: string }
> = {
  ORDER_PLACED: {
    title: "Order Placed",
    description: "Your order has been successfully placed.",
  },
  PROCESSING: {
    title: "Processing",
    description: "Your order is being prepared.",
  },
  PACKED: {
    title: "Packed",
    description: "Your product has been packed.",
  },
  SHIPPED: {
    title: "Shipped",
    description: "Your order has left the warehouse.",
  },
  OUT_FOR_DELIVERY: {
    title: "Out for Delivery",
    description: "Your order is on its way to you.",
  },
  DELIVERED: {
    title: "Delivered",
    description: "Your order has been delivered.",
  },
};

// Get the next delivery status
export function getNextStatus(
  currentStatus: OrderStatus
): OrderStatus | null {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);

  if (
    currentIndex === -1 ||
    currentIndex === STATUS_FLOW.length - 1
  ) {
    return null;
  }

  return STATUS_FLOW[currentIndex + 1];
}

// Create a tracking event with date and time
export function createTrackingEvent(
  status: OrderStatus,
  timestamp = new Date().toISOString()
): TrackingEvent {
  const details = STATUS_DETAILS[status];

  return {
    id: `${status}-${timestamp}`,
    status,
    title: details.title,
    description: details.description,
    timestamp,
  };
}