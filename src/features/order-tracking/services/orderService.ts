import type { TxRecord } from "@/lib/store/types";
import type { TrackedOrder } from "../types/order.types";

import { createTrackingEvent } from "./orderSimulator";
import {
  generateTrackingNumber,
  getEstimatedDelivery,
} from "../utils/orderHelpers";
import { getOrder, saveOrder } from "./orderStorage";

// Create a tracked order only after successful payment
export function createTrackedOrder(
  transaction: TxRecord
): TrackedOrder {
  // Prevent tracking orders with unsuccessful payments
  if (transaction.status !== "completed") {
    throw new Error(
      "Order tracking can only be created after successful payment."
    );
  }

  // Prevent duplicate tracked orders
  const existingOrder = getOrder(transaction.orderId);

  if (existingOrder) {
    return existingOrder;
  }

  const now = new Date().toISOString();

  const order: TrackedOrder = {
    orderId: transaction.orderId,
    trackingNumber: generateTrackingNumber(),
    productId: transaction.productId,
    productName: transaction.productName,
    merchant: transaction.merchant,
    amountCents: transaction.amountCents,
    currency: transaction.currency,
    status: "ORDER_PLACED",
    createdAt: now,
    estimatedDelivery: getEstimatedDelivery(5),
    updatedAt: now,
    events: [
      createTrackingEvent("ORDER_PLACED", now),
    ],
    isSimulated: true,
  };

  saveOrder(order);

  return order;
}