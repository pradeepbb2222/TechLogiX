/** Pure spending-limit logic, enforced on the server only. */

/** The browser may only ever make the limit stricter than the server's own cap. */
export function effectiveLimitCents(serverLimitCents: number, clientLimitUsd?: unknown): number {
  if (typeof clientLimitUsd === "number" && Number.isFinite(clientLimitUsd) && clientLimitUsd > 0) {
    return Math.min(serverLimitCents, Math.round(clientLimitUsd * 100));
  }
  return serverLimitCents;
}

export function checkLimit(args: { limitCents: number; committedCents: number; amountCents: number }): {
  ok: boolean;
  message?: string;
} {
  const { limitCents, committedCents, amountCents } = args;
  if (amountCents <= 0) return { ok: false, message: "Invalid amount." };
  if (committedCents + amountCents > limitCents) {
    const remaining = Math.max(0, limitCents - committedCents);
    return {
      ok: false,
      message: `Spending limit exceeded. Limit $${(limitCents / 100).toFixed(2)}, remaining $${(remaining / 100).toFixed(2)}.`,
    };
  }
  return { ok: true };
}
