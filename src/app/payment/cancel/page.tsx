import { Suspense } from "react";
import { PaymentResult } from "@/components/PaymentResult";

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResult mode="cancel" />
    </Suspense>
  );
}
