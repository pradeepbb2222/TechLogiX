
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { cancelPending } from "@/lib/checkout/logic";
import {
  errorReply,
  guardMutation,
  readOrderId,
  reply,
} from "@/lib/paypal/http";
import { getStore } from "@/lib/store";
import { toTransaction } from "@/lib/store/types";

/**
 * Cancels a not-yet-captured order after the buyer backs out at PayPal.
 * Only the authenticated owner can cancel their order.
 * Only `awaiting_approval` can become `cancelled`.
 */
export async function POST(request: Request) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;

  const orderId = await readOrderId(request);

  if (!orderId) {
    return reply(
      { status: "failed", message: "Missing or invalid order id." },
      400,
    );
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return reply(
      {
        status: "failed",
        message: "Authentication required. Please log in again.",
      },
      401,
    );
  }

  try {
    const result = await cancelPending(
      getStore(),
      orderId,
      user.id,
    );

    if (result.kind === "not_found") {
      return reply(
        { status: "failed", message: "Unknown order." },
        404,
      );
    }

    const { record } = result;

    return reply({
      status: record.status,
      message: record.note ?? "",
      transaction: toTransaction(record),
    });
  } catch (err) {
    return errorReply(err);
  }
}
