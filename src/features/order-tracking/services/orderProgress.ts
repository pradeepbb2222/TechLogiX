import type { TrackedOrder } from "../types/order.types";
import { createTrackingEvent, getNextStatus } from "./orderSimulator";
import { getOrder, updateOrder } from "./orderStorage";

// Move an order to its next delivery stage
export function advanceOrderStatus(
  orderId: string
): TrackedOrder | null {
  const order = getOrder(orderId);

  if (!order) {
    return null;
  }

  const nextStatus = getNextStatus(order.status);

  // No further stages after delivery
  if (!nextStatus) {
    return order;
  }

  const now = new Date().toISOString();

  const updatedOrder: TrackedOrder = {
    ...order,
    status: nextStatus,
    updatedAt: now,
    events: [
      ...order.events,
      createTrackingEvent(nextStatus, now),
    ],
  };

  updateOrder(orderId, updatedOrder);

  return updatedOrder;
}