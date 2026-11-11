import assert from "node:assert/strict";
import { test } from "node:test";
import { APICallError } from "ai";
import { handleTranscribeRequest } from "../src/app/api/transcribe/route";
import { MAX_REQUEST_BYTES } from "../src/lib/limited-form-data";

const WEBM_BYTES = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00,
]);

function createRequest(
  bytes: Uint8Array = WEBM_BYTES,
  mimeType = "audio/webm",
  includeAudio = true,
  extraHeaders?: Record<string, string>,
): Request {
  const formData = new FormData();

  if (includeAudio) {
    const audioBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(audioBuffer).set(bytes);

    formData.append(
      "audio",
      new Blob([audioBuffer], { type: mimeType }),
      "recording.webm",
    );
  }

  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: extraHeaders,
    body: formData,
  });
}

function createDependencies(
  overrides: Partial<{
    authenticate: () => Promise<{ id: string } | null>;
    checkRateLimit: (userId: string) => Promise<{
      success: boolean;
      remaining: number;
      reset: number;
    }>;
    transcribe: (
      buffer: Buffer,
      mimeType: string,
    ) => Promise<{ text: string }>;
  }> = {},
) {
  return {
    authenticate: async () => ({ id: "test-user" }),
    checkRateLimit: async () => ({
      success: true,
      remaining: 4,
      reset: Date.now() + 60_000,
    }),
    transcribe: async () => ({ text: "Test transcription" }),
    ...overrides,
  };
}

test("rejects unauthenticated requests", async () => {
  let rateLimitCalled = false;
  let transcribeCalled = false;

  const response = await handleTranscribeRequest(
    createRequest(),
    createDependencies({
      authenticate: async () => null,
      checkRateLimit: async () => {
        rateLimitCalled = true;
        return {
          success: true,
          remaining: 4,
          reset: Date.now() + 60_000,
        };
      },
      transcribe: async () => {
        transcribeCalled = true;
        return { text: "Unexpected" };
      },
    }),
  );

  assert.equal(response.status, 401);
  assert.equal(rateLimitCalled, false);
  assert.equal(transcribeCalled, false);
});

test("rejects requests exceeding the declared body size", async () => {
  let transcribeCalled = false;

  const request = createRequest(
    WEBM_BYTES,
    "audio/webm",
    true,
    { "content-length": String(MAX_REQUEST_BYTES + 1) },
  );

  const response = await handleTranscribeRequest(
    request,
    createDependencies({
      transcribe: async () => {
        transcribeCalled = true;
        return { text: "Unexpected" };
      },
    }),
  );

  assert.equal(response.status, 413);
  assert.equal(transcribeCalled, false);
});

test("rejects unsupported MIME types", async () => {
  let transcribeCalled = false;

  const response = await handleTranscribeRequest(
    createRequest(WEBM_BYTES, "audio/unsupported"),
    createDependencies({
      transcribe: async () => {
        transcribeCalled = true;
        return { text: "Unexpected" };
      },
    }),
  );

  assert.equal(response.status, 415);
  assert.equal(transcribeCalled, false);
});

test("rejects audio whose signature does not match its declared MIME type", async () => {
  let transcribeCalled = false;

  // WebM signature declared as MP4.
  const response = await handleTranscribeRequest(
    createRequest(WEBM_BYTES, "audio/mp4"),
    createDependencies({
      transcribe: async () => {
        transcribeCalled = true;
        return { text: "Unexpected" };
      },
    }),
  );

  assert.equal(response.status, 415);
  assert.equal(transcribeCalled, false);
});

test("successfully transcribes valid audio", async () => {
  let receivedBuffer: Buffer | undefined;
  let receivedMimeType: string | undefined;
  let receivedUserId: string | undefined;

  const response = await handleTranscribeRequest(
    createRequest(),
    createDependencies({
      checkRateLimit: async (userId) => {
        receivedUserId = userId;
        return {
          success: true,
          remaining: 4,
          reset: Date.now() + 60_000,
        };
      },
      transcribe: async (buffer, mimeType) => {
        receivedBuffer = buffer;
        receivedMimeType = mimeType;
        return { text: "  Hello from audio  " };
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    text: "  Hello from audio  ",
  });
  assert.equal(receivedUserId, "test-user");
  assert.equal(receivedMimeType, "audio/webm");
  assert.deepEqual(receivedBuffer, Buffer.from(WEBM_BYTES));
});

test("returns 429 when the user exceeds the rate limit", async () => {
  let transcribeCalled = false;

  const response = await handleTranscribeRequest(
    createRequest(),
    createDependencies({
      checkRateLimit: async () => ({
        success: false,
        remaining: 0,
        reset: Date.now() + 10_000,
      }),
      transcribe: async () => {
        transcribeCalled = true;
        return { text: "Unexpected" };
      },
    }),
  );

  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("Retry-After")) >= 1);
  assert.equal(transcribeCalled, false);
});

test("fails closed with 503 when the rate-limit service is unavailable", async () => {
  let transcribeCalled = false;

  const response = await handleTranscribeRequest(
    createRequest(),
    createDependencies({
      checkRateLimit: async () => {
        throw new Error("Redis unavailable");
      },
      transcribe: async () => {
        transcribeCalled = true;
        return { text: "Unexpected" };
      },
    }),
  );

  assert.equal(response.status, 503);
  assert.equal(transcribeCalled, false);
});

test("returns 429 and forwards Retry-After for a provider rate limit with Retry-After", async () => {
  const response = await handleTranscribeRequest(
    createRequest(),
    createDependencies({
      transcribe: async () => {
        throw new APICallError({
          message: "Too many requests",
          url: "https://example.com/transcribe",
          requestBodyValues: {},
          statusCode: 429,
          responseHeaders: { "retry-after": "41" },
          responseBody: "Rate limit exceeded",
          isRetryable: false,
        });
      },
    }),
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "41");
  assert.deepEqual(await response.json(), {
    error:
      "The transcription service is temporarily rate-limited. Please try again shortly.",
  });
});

test("returns 429 without forwarding an invalid provider Retry-After header", async () => {
  const response = await handleTranscribeRequest(
    createRequest(),
    createDependencies({
      transcribe: async () => {
        throw new APICallError({
          message: "Too many requests",
          url: "https://example.com/transcribe",
          requestBodyValues: {},
          statusCode: 429,
          responseHeaders: { "retry-after": "not-a-number" },
          responseBody: "Rate limit exceeded",
          isRetryable: false,
        });
      },
    }),
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), null);
  assert.deepEqual(await response.json(), {
    error:
      "The transcription service is temporarily rate-limited. Please try again shortly.",
  });
});
test("returns 500 when transcription fails", async () => {
  const response = await handleTranscribeRequest(
    createRequest(),
    createDependencies({
      transcribe: async () => {
        throw new Error("Gemini request failed");
      },
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "Unable to transcribe audio. Please try again.",
  });
});

test("rejects requests without an audio file", async () => {
  const response = await handleTranscribeRequest(
    createRequest(WEBM_BYTES, "audio/webm", false),
    createDependencies(),
  );

  assert.equal(response.status, 400);
});

test("rejects empty audio files", async () => {
  const response = await handleTranscribeRequest(
    createRequest(new Uint8Array(), "audio/webm"),
    createDependencies(),
  );

  assert.equal(response.status, 400);
});
