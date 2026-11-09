import type { TrackedOrder } from "../types/order.types.ts";

// Temporary in-memory storage for local development.
// This will later be replaced with secure server-side persistence.

const orders = new Map<string, TrackedOrder>();

// Add a new tracked order
export function saveOrder(order: TrackedOrder): void {
  orders.set(order.orderId, order);
}

// Get one order using its order ID
export function getOrder(
  orderId: string
): TrackedOrder | null {
  return orders.get(orderId) ?? null;
}

// Get all tracked orders
export function getAllOrders(): TrackedOrder[] {
  return Array.from(orders.values());
}

// Update an existing tracked order
export function updateOrder(
  orderId: string,
  updatedOrder: TrackedOrder
): boolean {
  if (!orders.has(orderId)) {
    return false;
  }

  orders.set(orderId, updatedOrder);
  return true;
}

// Remove an order
export function deleteOrder(orderId: string): boolean {
  return orders.delete(orderId);
}