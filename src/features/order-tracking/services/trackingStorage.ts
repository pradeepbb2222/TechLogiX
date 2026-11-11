
import "server-only";

import { getStore } from "@/lib/store";
import type {
  OrderStatus,
  TrackedOrder,
  TrackingEvent,
} from "../types/order.types";

import {
  createTrackingEvent,
  getNextStatus,
} from "./orderSimulator";

import {
  generateTrackingNumber,
  getEstimatedDelivery,
} from "../utils/orderHelpers";

interface TrackedOrderRow {
  order_id: string;
  user_id: string;
  tracking_number: string;
  product_id: string;
  product_name: string;
  merchant: string;
  amount_cents: number;
  currency: "USD";
  status: OrderStatus;
  estimated_delivery: string;
  created_at: string;
  updated_at: string;
}

interface TrackingEventRow {
  id: string;
  order_id: string;
  status: OrderStatus;
  title: string;
  description: string;
  timestamp: string;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error("Supabase server configuration is missing.");
  }

  return {
    base: `${url.replace(/\/+$/, "")}/rest/v1`,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
}

async function request<T>(
  table: string,
  query: string,
  init: RequestInit = {},
): Promise<T[]> {
  const { base, headers } = getSupabaseConfig();

  const response = await fetch(`${base}/${table}${query}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });

  const responseText = await response.text();

  if (!response.ok) {
    // Preserve safe messages needed by the API route for conflict handling.
    let databaseMessage = "";

    try {
      const errorBody = JSON.parse(responseText) as {
        message?: string;
      };

      databaseMessage = errorBody.message ?? "";
    } catch {
      // Keep the generic error if the response is not JSON.
    }

    if (databaseMessage.includes("Order status changed")) {
      throw new Error(
        "Order status changed. Please refresh and try again.",
      );
    }

    if (databaseMessage.includes("Order not found")) {
      throw new Error("Order not found.");
    }

    throw new Error(
      `Tracking database request failed (${response.status}).`,
    );
  }

  if (!responseText) {
    return [];
  }

  return JSON.parse(responseText) as T[];
}

async function getEvents(orderId: string): Promise<TrackingEvent[]> {
  const rows = await request<TrackingEventRow>(
    "tracking_events",
    `?order_id=eq.${encodeURIComponent(orderId)}&select=*&order=timestamp.asc`,
  );

  return rows.map((event) => ({
    id: event.id,
    status: event.status,
    title: event.title,
    description: event.description,
    timestamp: event.timestamp,
  }));
}

async function toTrackedOrder(
  row: TrackedOrderRow,
): Promise<TrackedOrder> {
  return {
    orderId: row.order_id,
    trackingNumber: row.tracking_number,
    productId: row.product_id,
    productName: row.product_name,
    merchant: row.merchant,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    estimatedDelivery: row.estimated_delivery,
    updatedAt: row.updated_at,
    events: await getEvents(row.order_id),
    isSimulated: true,
  };
}

// Create tracking only for a successfully paid order owned by this user.
export async function createTrackedOrder(
  orderId: string,
  userId: string,
): Promise<TrackedOrder> {
  const transaction = await getStore().get(orderId, userId);

  if (!transaction || transaction.userId !== userId) {
    throw new Error("Order not found.");
  }

  if (transaction.status !== "completed") {
    throw new Error("Order tracking requires successful payment.");
  }

  const existing = await request<TrackedOrderRow>(
    "tracked_orders",
    `?order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
  );

  if (existing[0]) {
    return toTrackedOrder(existing[0]);
  }

  const now = new Date().toISOString();
  const initialEvent = createTrackingEvent("ORDER_PLACED", now);

  // Atomically create the tracked order and its initial event.
  const rows = await request<TrackedOrderRow>(
    "rpc/create_tracked_order_with_event",
    "",
    {
      method: "POST",
      body: JSON.stringify({
        p_order_id: transaction.orderId,
        p_user_id: userId,
        p_tracking_number: generateTrackingNumber(),
        p_product_id: transaction.productId,
        p_product_name: transaction.productName,
        p_merchant: transaction.merchant,
        p_amount_cents: transaction.amountCents,
        p_currency: transaction.currency,
        p_estimated_delivery: getEstimatedDelivery(5),
        p_created_at: now,
        p_event_title: initialEvent.title,
        p_event_description: initialEvent.description,
        p_event_timestamp: initialEvent.timestamp,
      }),
    },
  );

  const created = rows[0];

  if (!created) {
    throw new Error("Could not create tracked order.");
  }

  return toTrackedOrder(created);
}

// Retrieve one tracked order belonging to the authenticated user.
export async function getTrackedOrder(
  orderId: string,
  userId: string,
): Promise<TrackedOrder | null> {
  const rows = await request<TrackedOrderRow>(
    "tracked_orders",
    `?order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
  );

  return rows[0] ? toTrackedOrder(rows[0]) : null;
}

// List only the authenticated user's tracked orders.
export async function getTrackedOrders(
  userId: string,
): Promise<TrackedOrder[]> {
  const rows = await request<TrackedOrderRow>(
    "tracked_orders",
    `?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc`,
  );

  return Promise.all(rows.map(toTrackedOrder));
}

// Advance one simulated delivery stage atomically.
export async function advanceTrackedOrder(
  orderId: string,
  userId: string,
): Promise<TrackedOrder | null> {
  const current = await getTrackedOrder(orderId, userId);

  if (!current) {
    return null;
  }

  const nextStatus = getNextStatus(current.status);

  if (!nextStatus) {
    return current;
  }

  const now = new Date().toISOString();
  const event = createTrackingEvent(nextStatus, now);

  // Update the order and insert its event in one database transaction.
  const rows = await request<TrackedOrderRow>(
    "rpc/advance_tracked_order_with_event",
    "",
    {
      method: "POST",
      body: JSON.stringify({
        p_order_id: orderId,
        p_user_id: userId,
        p_expected_status: current.status,
        p_next_status: nextStatus,
        p_event_title: event.title,
        p_event_description: event.description,
        p_event_timestamp: event.timestamp,
      }),
    },
  );

  const updated = rows[0];

  if (!updated) {
    throw new Error("Could not advance order status.");
  }

  return toTrackedOrder(updated);
}
