export interface HistoricalPricePoint {
  timestamp: string;
  price: number;
  currency: string;
}

export type PriceAssessment =
  | "below_average"
  | "typical"
  | "above_average";

export type RecentLowAssessment =
  | "at_or_below_low"
  | "near_low"
  | "above_low"
  | "insufficient_data";

export interface PriceAnalysis {
  sampleCount: number;
  periodStart: string;
  periodEnd: string;

  minPrice: number;
  maxPrice: number;
  averagePrice: number;

  standardDeviation: number;
  volatilityPercent: number;

  currentVsAveragePercent: number;
  priceAssessment: PriceAssessment;

  lowestPrice30Days: number | null;
  currentVs30DayLowPercent: number | null;
  recentLowAssessment: RecentLowAssessment;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const PRICE_ASSESSMENT_BAND_PERCENT = 5;
export const RECENT_LOW_BAND_PERCENT = 5;

/**
 * Analyses genuine historical price observations.
 *
 * Invalid records, non-positive prices, future timestamps,
 * and records with a different currency are excluded.
 *
 * Returns null when no valid historical observations remain.
 */
export function analyzePriceHistory(
  points: readonly HistoricalPricePoint[],
  currentPrice: number,
  currency: string,
  now: Date = new Date(),
): PriceAnalysis | null {
  if (
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    !currency.trim() ||
    !Number.isFinite(now.getTime())
  ) {
    return null;
  }

  const expectedCurrency = currency.trim().toUpperCase();
  const nowMs = now.getTime();

  const validPoints = points
    .filter((point) => {
      if (
        !Number.isFinite(point.price) ||
        point.price <= 0 ||
        point.currency.trim().toUpperCase() !== expectedCurrency
      ) {
        return false;
      }

      const timestamp = Date.parse(point.timestamp);

      return Number.isFinite(timestamp) && timestamp <= nowMs;
    })
    .map((point) => ({
      timestamp: new Date(point.timestamp).getTime(),
      isoTimestamp: new Date(point.timestamp).toISOString(),
      price: point.price,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (validPoints.length === 0) {
    return null;
  }

  const prices = validPoints.map((point) => point.price);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const averagePrice =
    prices.reduce((sum, price) => sum + price, 0) /
    prices.length;

  const variance =
    prices.reduce(
      (sum, price) => sum + (price - averagePrice) ** 2,
      0,
    ) / prices.length;

  const standardDeviation = Math.sqrt(variance);

  const volatilityPercent =
    (standardDeviation / averagePrice) * 100;

  const currentVsAveragePercent =
    ((currentPrice - averagePrice) / averagePrice) * 100;

  const priceAssessment: PriceAssessment =
    currentVsAveragePercent <= -PRICE_ASSESSMENT_BAND_PERCENT
      ? "below_average"
      : currentVsAveragePercent >= PRICE_ASSESSMENT_BAND_PERCENT
        ? "above_average"
        : "typical";

  const cutoff30Days = nowMs - 30 * DAY_MS;

  const recentPoints = validPoints.filter(
    (point) => point.timestamp >= cutoff30Days,
  );

  const lowestPrice30Days =
    recentPoints.length > 0
      ? Math.min(...recentPoints.map((point) => point.price))
      : null;

  const currentVs30DayLowPercent =
    lowestPrice30Days !== null
      ? ((currentPrice - lowestPrice30Days) / lowestPrice30Days) * 100
      : null;

  let recentLowAssessment: RecentLowAssessment =
    "insufficient_data";

  if (
    lowestPrice30Days !== null &&
    currentVs30DayLowPercent !== null
  ) {
    if (currentPrice <= lowestPrice30Days) {
      recentLowAssessment = "at_or_below_low";
    } else if (
      currentVs30DayLowPercent <= RECENT_LOW_BAND_PERCENT
    ) {
      recentLowAssessment = "near_low";
    } else {
      recentLowAssessment = "above_low";
    }
  }

  return {
    sampleCount: validPoints.length,
    periodStart: validPoints[0].isoTimestamp,
    periodEnd: validPoints[validPoints.length - 1].isoTimestamp,

    minPrice,
    maxPrice,
    averagePrice,

    standardDeviation,
    volatilityPercent,

    currentVsAveragePercent,
    priceAssessment,

    lowestPrice30Days,
    currentVs30DayLowPercent,
    recentLowAssessment,
  };
}
