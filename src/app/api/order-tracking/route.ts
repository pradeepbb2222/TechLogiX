import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createTrackedOrder } from "@/features/order-tracking/services/trackingStorage";
import { createOrderTrackingHandler } from "@/features/order-tracking/api/orderTrackingHandler";

export const POST = createOrderTrackingHandler({
  getAuthenticatedUser,
  createTrackedOrder,
});
