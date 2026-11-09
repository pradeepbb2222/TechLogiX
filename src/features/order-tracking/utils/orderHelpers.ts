import type { OrderStatus } from "../types/order.types";

// Generate a demo tracking number
export function generateTrackingNumber(): string {
  const randomPart = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();

  return `TLX-${randomPart}`;
}

// Calculate estimated delivery date
export function getEstimatedDelivery(days = 5): string {
  const deliveryDate = new Date();

  deliveryDate.setDate(deliveryDate.getDate() + days);

  return deliveryDate.toISOString();
}

// Convert status into readable text
export function formatOrderStatus(status: OrderStatus): string {
  const statusLabels: Record<OrderStatus, string> = {
    ORDER_PLACED: "Order Placed",
    PROCESSING: "Processing",
    PACKED: "Packed",
    SHIPPED: "Shipped",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
  };

  return statusLabels[status];
}

// Format date and time for display
export function formatTrackingDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}