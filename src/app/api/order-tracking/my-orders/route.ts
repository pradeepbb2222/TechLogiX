import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getStore } from "@/lib/store";
import {
  createTrackedOrder,
  getTrackedOrders,
} from "@/features/order-tracking/services/trackingStorage";
import { createMyOrdersHandler } from "@/features/order-tracking/api/orderTrackingHandler";

export const GET = createMyOrdersHandler({
  getAuthenticatedUser,
  getTrackedOrders,
  listTransactions: (userId) => getStore().listByUser(userId),
  createTrackedOrder,
});
