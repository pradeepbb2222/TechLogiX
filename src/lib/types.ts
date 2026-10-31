export type PaymentStatus =
  | "not_started"
  | "awaiting_approval"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface Product {
  id: string;
  name: string;
  merchant: string;
  category: string;
  price: number;
  currency: "USD";
  rating: number;
  reviews: number;
  deliveryDays: number;
  highlights: string[];
  /** Agent's ranking score (0-100). */
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  detail?: string;
  tone: "info" | "success" | "warning" | "error";
  createdAt: string;
}

export interface Transaction {
  id: string;
  productName: string;
  merchant: string;
  amount: number;
  currency: "USD";
  status: PaymentStatus;
  note?: string;
  createdAt: string;
}

export interface SearchResponse {
  reply: string;
  products: Product[];
  recommendedId: string | null;
  parsedBudget: number | null;
}

export interface PaymentResponse {
  status: PaymentStatus;
  message: string;
}
