export type OrderStatus =
  | "ORDER_PLACED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";

export interface TrackingEvent {
  id: string;
  status: OrderStatus;
  title: string;
  description: string;
  timestamp: string;
}

export interface TrackedOrder {
  orderId: string;
  trackingNumber: string;
  productId: string;
  productName: string;
  merchant: string;
  amountCents: number;
  currency: "USD";
  status: OrderStatus;
  createdAt: string;
  estimatedDelivery: string;
  updatedAt: string;
  events: TrackingEvent[];
  isSimulated: true;
}