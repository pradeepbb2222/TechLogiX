
import { NextResponse } from "next/server";
import { checkMutationRequest } from "../security/request-guard";
import type { PaymentResponse } from "../types";
import { PayPalConfigError, getAppUrl } from "./config";
import { PayPalApiError } from "./client";

export function reply(
  body: PaymentResponse & Record<string, unknown>,
  httpStatus = 200,
  headers?: Record<string, string>,
) {
  return NextResponse.json(body, {
    status: httpStatus,
    headers,
  });
}

/** Maps internal errors to safe client messages. Logs only non-secret diagnostics. */
export function errorReply(err: unknown) {
  if (err instanceof PayPalConfigError) {
    return reply({ status: "failed", message: err.message }, 503);
  }

  if (err instanceof PayPalApiError) {
    console.error(
      `[paypal] ${err.httpStatus} ${err.issue ?? ""} debug_id=${err.debugId ?? "n/a"}`,
    );

    return reply(
      {
        status: "failed",
        message: `${err.message}${err.debugId ? ` (PayPal debug id: ${err.debugId})` : ""}`,
      },
      502,
    );
  }

  console.error("[agentflow] unexpected error:", err);

  return reply(
    {
      status: "failed",
      message: "Unexpected server error. No money was moved.",
    },
    500,
  );
}

const ORDER_ID = /^[A-Za-z0-9-]{8,40}$/;

export async function readOrderId(
  request: Request,
): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as {
    orderId?: unknown;
  } | null;

  return typeof body?.orderId === "string" && ORDER_ID.test(body.orderId)
    ? body.orderId
    : null;
}

/** Origin + content-type check for payment mutation endpoints. */
export function guardMutation(request: Request) {
  const result = checkMutationRequest(
    request.headers,
    request.url,
    getAppUrl(),
  );

  return result.ok
    ? null
    : reply(
        { status: "failed", message: result.message },
        result.status,
      );
}
