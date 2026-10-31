import { cancelPending } from "@/lib/checkout/logic";
import { errorReply, guardMutation, readOrderId, reply, sessionFromRequest } from "@/lib/paypal/http";
import { getStore } from "@/lib/store";
import { toTransaction } from "@/lib/store/types";

/**
 * Cancels a not-yet-captured order after the buyer backs out at PayPal.
 * Only the owning session can cancel; only `awaiting_approval` can become `cancelled`.
 * For any other state the real status is returned unchanged.
 */
export async function POST(request: Request) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;

  const orderId = await readOrderId(request);
  if (!orderId) return reply({ status: "failed", message: "Missing or invalid order id." }, 400);

  try {
    const result = await cancelPending(getStore(), orderId, sessionFromRequest(request)?.hash);
    if (result.kind === "not_found") {
      return reply({ status: "failed", message: "Unknown order, or your browser session has expired." }, 404);
    }
    const { record } = result;
    return reply({ status: record.status, message: record.note ?? "", transaction: toTransaction(record) });
  } catch (err) {
    return errorReply(err);
  }
}
