import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type TranscriptionRateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
  reason?: string;
};

type RateLimiter = {
  limit: (identifier: string) => Promise<TranscriptionRateLimitResult>;
};

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Transcription rate-limit service is unavailable.");
    this.name = "RateLimitUnavailableError";
  }
}

let rateLimiter: RateLimiter | undefined;

/**
 * Evaluates a user's rate limit. A timeout is treated as unavailable,
 * even though Upstash reports success: true for timeout responses.
 */
export async function evaluateTranscriptionRateLimit(
  userId: string,
  limiter: RateLimiter,
): Promise<TranscriptionRateLimitResult> {
  if (!userId.trim()) {
    throw new RateLimitUnavailableError();
  }

  let result: TranscriptionRateLimitResult;

  try {
    result = await limiter.limit(userId);
  } catch {
    throw new RateLimitUnavailableError();
  }

  if (result.reason === "timeout") {
    throw new RateLimitUnavailableError();
  }

  return result;
}

function getRateLimiter(): RateLimiter {
  if (rateLimiter) {
    return rateLimiter;
  }

  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new RateLimitUnavailableError();
  }

  try {
    rateLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "cognicart:transcribe",
      analytics: false,
      timeout: 5000,
    });
  } catch {
    throw new RateLimitUnavailableError();
  }

  return rateLimiter;
}

export async function checkTranscriptionRateLimit(
  userId: string,
): Promise<TranscriptionRateLimitResult> {
  return evaluateTranscriptionRateLimit(userId, getRateLimiter());
}
