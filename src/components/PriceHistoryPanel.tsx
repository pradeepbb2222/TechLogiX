
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import {
  analyzePriceHistory,
  type HistoricalPricePoint,
} from "@/lib/pricing/price-analysis";

interface Props {
  selected: Product | null;
}

interface PriceHistoryResponse {
  canonicalProductId: string;
  productTitle: string | null;
  history: HistoricalPricePoint[];
  statistics: {
    mean: number;
    std_dev: number;
    min_price: number;
    max_price: number;
    current_price: number;
    current_status: "low" | "typical" | "high";
    currency: string;
  } | null;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading"; productId: string }
  | { status: "error"; productId: string; message: string }
  | {
      status: "loaded";
      productId: string;
      data: PriceHistoryResponse;
      referenceTime: number;
    };

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isValidStatistics(
  value: unknown,
): value is PriceHistoryResponse["statistics"] {
  if (value === null) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const statistics = value as Record<string, unknown>;

  return (
    Number.isFinite(statistics.mean) &&
    Number.isFinite(statistics.std_dev) &&
    Number.isFinite(statistics.min_price) &&
    Number.isFinite(statistics.max_price) &&
    Number.isFinite(statistics.current_price) &&
    typeof statistics.currency === "string" &&
    ["low", "typical", "high"].includes(
      String(statistics.current_status),
    )
  );
}

function isValidPriceHistoryResponse(
  value: unknown,
): value is PriceHistoryResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    typeof result.canonicalProductId === "string" &&
    Array.isArray(result.history) &&
    isValidStatistics(result.statistics)
  );
}

function PriceChart({
  points,
  currency,
}: {
  points: HistoricalPricePoint[];
  currency: string;
}) {
  const chart = useMemo(() => {
    const width = 640;
    const height = 190;
    const padding = 24;

    const prices = points.map((point) => point.price);

    if (prices.length === 0) {
      return {
        width,
        height,
        coordinates: [] as { x: number; y: number }[],
        line: "",
        min: 0,
        max: 0,
      };
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || max * 0.1 || 1;

    const coordinates = points.map((point, index) => ({
      x:
        padding +
        (index / Math.max(points.length - 1, 1)) *
          (width - padding * 2),
      y:
        height -
        padding -
        ((point.price - min) / range) *
          (height - padding * 2),
    }));

    return {
      width,
      height,
      coordinates,
      line: coordinates
        .map((point) => `${point.x},${point.y}`)
        .join(" "),
      min,
      max,
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-slate-700">
          No chart data available
        </p>
        <p className="mt-1 text-xs text-slate-500">
          No valid historical observations are available to plot.
        </p>
      </div>
    );
  }

  const firstDate = points[0].timestamp;
  const lastDate = points[points.length - 1].timestamp;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{formatDate(firstDate)}</span>
        <span>Historical observations</span>
        <span>{formatDate(lastDate)}</span>
      </div>

      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="Historical product price chart"
        className="mt-2 h-44 w-full overflow-visible"
      >
        {[0, 1, 2, 3].map((line) => {
          const y = 24 + (line / 3) * (chart.height - 48);

          return (
            <line
              key={line}
              x1="24"
              x2={chart.width - 24}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
          );
        })}

        {chart.coordinates.length > 1 && (
          <polyline
            points={chart.line}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {chart.coordinates.map((point, index) => (
          <circle
            key={`${points[index].timestamp}-${index}`}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill="#2563eb"
          >
            <title>
              {formatDate(points[index].timestamp)}:{" "}
              {formatPrice(points[index].price, currency)}
            </title>
          </circle>
        ))}
      </svg>

      <div className="flex justify-between text-xs text-slate-500">
        <span>Low: {formatPrice(chart.min, currency)}</span>
        <span>High: {formatPrice(chart.max, currency)}</span>
      </div>
    </div>
  );
}

export function PriceHistoryPanel({ selected }: Props) {
  const [state, setState] = useState<LoadState>({
    status: "idle",
  });

  const selectedId = selected?.id;
  const selectedPrice = selected?.price;
  const selectedCurrency = selected?.currency;

  // Fetch historical data only when the product ID changes.
  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const productId = selectedId;
    const controller = new AbortController();

    async function loadHistory() {
      setState({
        status: "loading",
        productId,
      });

      try {
        const params = new URLSearchParams({
          productId,
        });

        const response = await fetch(
          `/api/price-history?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result: unknown = await response.json();

        if (!response.ok) {
          const errorMessage =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "Unable to retrieve price history.";

          throw new Error(errorMessage);
        }

        if (!isValidPriceHistoryResponse(result)) {
          throw new Error("The price history response was invalid.");
        }

        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "loaded",
          productId,
          data: result,
          referenceTime: Date.now(),
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          productId,
          message:
            error instanceof Error
              ? error.message
              : "Unable to retrieve price history.",
        });
      }
    }

    void loadHistory();

    return () => controller.abort();
  }, [selectedId]);

  // Recalculate analysis when the selected price changes.
  // This does not trigger another historical API request.
  const analysis = useMemo(() => {
    if (
      state.status !== "loaded" ||
      !selectedId ||
      state.productId !== selectedId ||
      selectedPrice === undefined ||
      selectedCurrency === undefined
    ) {
      return null;
    }

    return analyzePriceHistory(
      state.data.history,
      selectedPrice,
      selectedCurrency,
      new Date(state.referenceTime),
    );
  }, [state, selectedId, selectedPrice, selectedCurrency]);

  // Filter chart points using the same reference time as the analysis.
  const chartPoints = useMemo(() => {
    if (
      state.status !== "loaded" ||
      !selectedId ||
      state.productId !== selectedId ||
      selectedCurrency === undefined
    ) {
      return [];
    }

    const referenceTime = state.referenceTime;

    return state.data.history
      .filter(
        (point) =>
          Number.isFinite(point.price) &&
          point.price > 0 &&
          typeof point.currency === "string" &&
          point.currency.toUpperCase() ===
            selectedCurrency.toUpperCase() &&
          Number.isFinite(Date.parse(point.timestamp)) &&
          Date.parse(point.timestamp) <= referenceTime,
      )
      .sort(
        (a, b) =>
          Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );
  }, [state, selectedId, selectedCurrency]);

  if (!selected) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">
          Historical Price Verification
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Select a product to view its historical pricing.
        </p>
      </section>
    );
  }

  // A state belonging to another product must never be displayed.
  const isCurrentProductState =
    state.status !== "idle" &&
    state.productId === selected.id;

  const isLoading =
    !isCurrentProductState || state.status === "loading";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">
            Historical Price Verification
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Independent price-history analysis powered by Channel3
          </p>
        </div>

        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          90-day history request
        </span>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <p className="text-xs text-slate-500">
          Selected product
        </p>
        <p className="mt-1 font-medium text-slate-900">
          {selected.name}
        </p>
        <p className="mt-1 text-lg font-bold text-slate-900">
          {formatPrice(selected.price, selected.currency)}
        </p>
      </div>

      {isLoading && (
        <div className="py-10 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          <p className="mt-3 text-sm text-slate-500">
            Retrieving genuine historical prices...
          </p>
        </div>
      )}

      {state.status === "error" &&
        state.productId === selected.id && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">
              Price history unavailable
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {state.message}
            </p>
            <p className="mt-2 text-xs text-amber-700">
              No historical prices have been fabricated or substituted.
            </p>
          </div>
        )}

      {state.status === "loaded" &&
        state.productId === selected.id &&
        !analysis && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">
              No usable historical observations found
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Channel3 did not return valid price observations
              in the selected product&apos;s currency.
            </p>
          </div>
        )}

      {state.status === "loaded" &&
        state.productId === selected.id &&
        analysis && (
          <>
            <PriceChart
              points={chartPoints}
              currency={selected.currency}
            />

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric
                label="Current shopping offer"
                value={formatPrice(selected.price, selected.currency)}
              />

              <Metric
                label="Channel3 tracked current price"
                value={
                  state.data.statistics &&
                  state.data.statistics.currency.toUpperCase() ===
                    selected.currency.toUpperCase()
                    ? formatPrice(
                        state.data.statistics.current_price,
                        state.data.statistics.currency,
                      )
                    : "Unavailable"
                }
              />

              <Metric
                label="Channel3 price status"
                value={
                  state.data.statistics &&
                  state.data.statistics.currency.toUpperCase() ===
                    selected.currency.toUpperCase()
                    ? state.data.statistics.current_status.toUpperCase()
                    : "Unavailable"
                }
              />

              <Metric
                label="Historical average"
                value={formatPrice(
                  analysis.averagePrice,
                  selected.currency,
                )}
              />

              <Metric
                label="Historical minimum"
                value={formatPrice(
                  analysis.minPrice,
                  selected.currency,
                )}
              />

              <Metric
                label="Historical maximum"
                value={formatPrice(
                  analysis.maxPrice,
                  selected.currency,
                )}
              />

              <Metric
                label="30-day observed low"
                value={
                  analysis.lowestPrice30Days === null
                    ? "Insufficient data"
                    : formatPrice(
                        analysis.lowestPrice30Days,
                        selected.currency,
                      )
                }
              />

              <Metric
                label="Price volatility"
                value={`${analysis.volatilityPercent.toFixed(1)}%`}
              />

              <Metric
                label="Historical observations"
                value={String(analysis.sampleCount)}
              />
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Shopping offer vs historical prices
              </p>

              <p className="mt-2 text-sm text-slate-700">
                {analysis.priceAssessment === "below_average"
                  ? "The selected shopping offer is more than 5% below the historical average."
                  : analysis.priceAssessment === "above_average"
                    ? "The selected shopping offer is more than 5% above the historical average."
                    : "The selected shopping offer is within 5% of the historical average."}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                {Math.abs(analysis.currentVsAveragePercent).toFixed(1)}%
                {" "}
                {analysis.currentVsAveragePercent > 0
                  ? "above"
                  : analysis.currentVsAveragePercent < 0
                    ? "below"
                    : "equal to"}{" "}
                the historical average.
              </p>

              <p className="mt-3 text-sm text-slate-700">
                {analysis.recentLowAssessment === "insufficient_data"
                  ? "There are not enough recent observations to assess the 30-day low."
                  : analysis.recentLowAssessment === "at_or_below_low"
                    ? "The selected shopping offer is at or below the lowest observed price in the last 30 days."
                    : analysis.recentLowAssessment === "near_low"
                      ? "The selected shopping offer is within 5% of the lowest observed price in the last 30 days."
                      : "The selected shopping offer is more than 5% above the lowest observed price in the last 30 days."}
              </p>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Analysis uses actual Channel3 observations returned
              for this product. The 30-day low reflects available
              observations, not estimated daily prices. Volatility
              is calculated as population standard deviation divided
              by the historical average.
            </p>
          </>
        )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}
