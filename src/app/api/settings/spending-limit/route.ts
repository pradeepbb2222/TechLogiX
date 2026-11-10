
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import {
  getUserSpendingLimitCents,
  updateUserSpendingLimitCents,
  MIN_SPENDING_LIMIT_CENTS,
  MAX_SPENDING_LIMIT_CENTS,
} from "@/lib/spending-limits";
import { guardMutation } from "@/lib/paypal/http";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 },
      );
    }

    const limitCents = await getUserSpendingLimitCents(user.id);

    return NextResponse.json({
      limitUsd: limitCents / 100,
      minLimitUsd: MIN_SPENDING_LIMIT_CENTS / 100,
      maxLimitUsd: MAX_SPENDING_LIMIT_CENTS / 100,
    });
  } catch (error) {
    console.error("Spending limit GET error:", error);

    return NextResponse.json(
      { error: "Could not load your spending limit." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const blocked = guardMutation(request);
  if (blocked) return blocked;

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const limitUsd = body?.limitUsd;

    if (
      typeof limitUsd !== "number" ||
      !Number.isFinite(limitUsd) ||
      !Number.isInteger(limitUsd * 100)
    ) {
      return NextResponse.json(
        { error: "Enter a valid spending limit." },
        { status: 400 },
      );
    }

    const limitCents = Math.round(limitUsd * 100);

    if (
      limitCents < MIN_SPENDING_LIMIT_CENTS ||
      limitCents > MAX_SPENDING_LIMIT_CENTS
    ) {
      return NextResponse.json(
        { error: "Spending limit must be between $1 and $1,000." },
        { status: 400 },
      );
    }

    const savedLimit = await updateUserSpendingLimitCents(
      user.id,
      limitCents,
    );

    return NextResponse.json({
      message: "Spending limit saved successfully.",
      limitUsd: savedLimit / 100,
    });
  } catch (error) {
    console.error("Spending limit PATCH error:", error);

    return NextResponse.json(
      { error: "Could not save your spending limit." },
      { status: 500 },
    );
  }
}
