import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateTranscriptionRateLimit,
  RateLimitUnavailableError,
} from "../src/lib/transcribe-rate-limit";

const USER_ID = "test-user-123";

test("rate limiter allows a user within the limit", async () => {
  const result = await evaluateTranscriptionRateLimit(USER_ID, {
    async limit(userId) {
      assert.equal(userId, USER_ID);
      return {
        success: true,
        remaining: 4,
        reset: Date.now() + 60_000,
      };
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.remaining, 4);
});

test("rate limiter reports a user who exceeded the limit", async () => {
  const result = await evaluateTranscriptionRateLimit(USER_ID, {
    async limit() {
      return {
        success: false,
        remaining: 0,
        reset: Date.now() + 30_000,
      };
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.remaining, 0);
});

test("rate limiter fails closed when Upstash times out", async () => {
  await assert.rejects(
    evaluateTranscriptionRateLimit(USER_ID, {
      async limit() {
        return {
          success: true,
          remaining: 0,
          reset: 0,
          reason: "timeout",
        };
      },
    }),
    RateLimitUnavailableError,
  );
});

test("rate limiter fails closed when Redis throws an error", async () => {
  await assert.rejects(
    evaluateTranscriptionRateLimit(USER_ID, {
      async limit() {
        throw new Error("Redis connection failed");
      },
    }),
    RateLimitUnavailableError,
  );
});

test("rate limiter rejects an empty user ID", async () => {
  await assert.rejects(
    evaluateTranscriptionRateLimit("", {
      async limit() {
        throw new Error("This should not be called");
      },
    }),
    RateLimitUnavailableError,
  );
});
