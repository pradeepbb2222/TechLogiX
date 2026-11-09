
export type PaymentStatus =
  | "not_started"
  | "awaiting_approval"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type RequirementStatus =
  | "verified"
  | "unknown"
  | "mismatch";

export interface ProductRequirement {
  requirement: string;
  status: RequirementStatus;
  evidence: string;
}
export interface Product {
  id: string;
  name: string;
  merchant: string;
  category: string;
  price: number;
  currency: "USD";

  // Actual Channel3 rating data.
  rating?: number;
  reviews?: number;

  // Actual product image and merchant offer URL.
  imageUrl?: string;
  productUrl: string;

  // Product information from Channel3.
  description?: string;
  highlights: string[];
  materials?: string[];
  structuredAttributes?: Record<string, string[]>;

  /** Agent's ranking score (0-100). */
  score?: number;


    /** AI-generated explanation for the product's ranking. */
  aiReason?: string;

  /** Evidence showing whether requirements are satisfied. */
  requirements?: ProductRequirement[];

  /** Whether the product passes all mandatory requirements. */
  isEligible?: boolean;
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
