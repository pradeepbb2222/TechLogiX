export interface ReceiptItem {
  productId: string;
  productName: string;
  merchant: string;
  amount: number;
  currency: "USD";
}

export interface Receipt {
  receiptNumber: string;
  orderId: string;
  captureId: string;
  status: "completed";
  item: ReceiptItem;
  amount: number;
  currency: "USD";
  paymentMethod: string;
  environment: "sandbox" | "live";
  createdAt: string;
  completedAt: string;
  note?: string;
}