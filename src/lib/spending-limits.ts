
import "server-only";

import { createClient } from "@/lib/supabase/server";

export const DEFAULT_SPENDING_LIMIT_CENTS = 100_000;
export const MAX_SPENDING_LIMIT_CENTS = 100_000;
export const MIN_SPENDING_LIMIT_CENTS = 100;

export async function getUserSpendingLimitCents(
  userId: string,
): Promise<number> {
  const supabase = await createClient();

  // Create the default row if this user does not have one yet.
  const { error: insertError } = await supabase
    .from("user_spending_limits")
    .upsert(
      {
        user_id: userId,
        limit_cents: DEFAULT_SPENDING_LIMIT_CENTS,
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: true,
      },
    );

  if (insertError) {
    throw new Error("Could not initialize spending limit.");
  }

  const { data, error } = await supabase
    .from("user_spending_limits")
    .select("limit_cents")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Could not retrieve spending limit.");
  }

  return data.limit_cents;
}

export async function updateUserSpendingLimitCents(
  userId: string,
  limitCents: number,
): Promise<number> {
  if (
    !Number.isInteger(limitCents) ||
    limitCents < MIN_SPENDING_LIMIT_CENTS ||
    limitCents > MAX_SPENDING_LIMIT_CENTS
  ) {
    throw new Error("Spending limit must be between $1 and $1,000.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_spending_limits")
    .upsert(
      {
        user_id: userId,
        limit_cents: limitCents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("limit_cents")
    .single();

  if (error || !data) {
    throw new Error("Could not save spending limit.");
  }

  return data.limit_cents;
}
