import test from "node:test";
import assert from "node:assert/strict";

import { analyzePriceHistory } from "../src/lib/pricing/price-analysis";

const NOW = new Date("2026-11-09T12:00:00.000Z");

const sampleHistory = [
  {
    timestamp: "2026-10-11T12:00:00.000Z",
    price: 100,
    currency: "USD",
  },
  {
    timestamp: "2026-10-26T12:00:00.000Z",
    price: 120,
    currency: "USD",
  },
  {
    timestamp: "2026-11-04T12:00:00.000Z",
    price: 80,
    currency: "USD",
  },
];

test("calculates historical price statistics correctly", () => {
  const result = analyzePriceHistory(
    sampleHistory,
    90,
    "USD",
    NOW,
  );

  assert.ok(result);

  assert.equal(result.sampleCount, 3);
  assert.equal(result.minPrice, 80);
  assert.equal(result.maxPrice, 120);
  assert.equal(result.averagePrice, 100);

  assert.equal(result.priceAssessment, "below_average");
  assert.equal(result.currentVsAveragePercent, -10);

  assert.equal(result.lowestPrice30Days, 80);
  assert.equal(result.currentVs30DayLowPercent, 12.5);
  assert.equal(result.recentLowAssessment, "above_low");
});

test("sorts historical observations chronologically", () => {
  const result = analyzePriceHistory(
    [...sampleHistory].reverse(),
    100,
    "USD",
    NOW,
  );

  assert.ok(result);

  assert.equal(
    result.periodStart,
    "2026-10-11T12:00:00.000Z",
  );

  assert.equal(
    result.periodEnd,
    "2026-11-04T12:00:00.000Z",
  );
});

test("excludes invalid prices, timestamps, currencies and future records", () => {
  const history = [
    ...sampleHistory,
    {
      timestamp: "2026-11-05T12:00:00.000Z",
      price: 0,
      currency: "USD",
    },
    {
      timestamp: "2026-11-05T12:00:00.000Z",
      price: -10,
      currency: "USD",
    },
    {
      timestamp: "invalid-date",
      price: 50,
      currency: "USD",
    },
    {
      timestamp: "2026-11-10T12:00:00.000Z",
      price: 50,
      currency: "USD",
    },
    {
      timestamp: "2026-11-05T12:00:00.000Z",
      price: 50,
      currency: "EUR",
    },
  ];

  const result = analyzePriceHistory(
    history,
    90,
    "USD",
    NOW,
  );

  assert.ok(result);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.minPrice, 80);
  assert.equal(result.maxPrice, 120);
});

test("accepts currency codes without case sensitivity", () => {
  const result = analyzePriceHistory(
    [
      {
        timestamp: "2026-11-04T12:00:00.000Z",
        price: 100,
        currency: "usd",
      },
    ],
    100,
    "USD",
    NOW,
  );

  assert.ok(result);
  assert.equal(result.sampleCount, 1);
});

test("returns null when no valid historical observations exist", () => {
  const result = analyzePriceHistory(
    [],
    100,
    "USD",
    NOW,
  );

  assert.equal(result, null);
});

test("reports insufficient data when there are no observations in the last 30 days", () => {
  const result = analyzePriceHistory(
    [
      {
        timestamp: "2026-10-01T12:00:00.000Z",
        price: 100,
        currency: "USD",
      },
    ],
    100,
    "USD",
    NOW,
  );

  assert.ok(result);
  assert.equal(result.lowestPrice30Days, null);
  assert.equal(result.currentVs30DayLowPercent, null);
  assert.equal(result.recentLowAssessment, "insufficient_data");
});

test("classifies prices at the five-percent assessment boundaries", () => {
  const history = [
    {
      timestamp: "2026-11-04T12:00:00.000Z",
      price: 100,
      currency: "USD",
    },
    {
      timestamp: "2026-11-05T12:00:00.000Z",
      price: 100,
      currency: "USD",
    },
  ];

  const below = analyzePriceHistory(
    history,
    95,
    "USD",
    NOW,
  );

  const above = analyzePriceHistory(
    history,
    105,
    "USD",
    NOW,
  );

  assert.equal(below?.priceAssessment, "below_average");
  assert.equal(above?.priceAssessment, "above_average");
});

test("rejects invalid current prices and currencies", () => {
  assert.equal(
    analyzePriceHistory(sampleHistory, 0, "USD", NOW),
    null,
  );

  assert.equal(
    analyzePriceHistory(sampleHistory, 100, "", NOW),
    null,
  );

  assert.equal(
    analyzePriceHistory(sampleHistory, 100, "USD", new Date("invalid")),
    null,
  );
});
