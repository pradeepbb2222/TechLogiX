import { Suspense } from "react";
import { PaymentResult } from "@/components/PaymentResult";

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResult mode="return" />
    </Suspense>
  );
}
