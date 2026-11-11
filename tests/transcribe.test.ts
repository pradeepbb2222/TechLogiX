import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTranscriptionAbortSignal,
  TRANSCRIPTION_TIMEOUT_MS,
} from "../src/lib/transcribe";

test("uses a 30-second transcription timeout configuration", () => {
  assert.equal(TRANSCRIPTION_TIMEOUT_MS, 30_000);
});

test("creates an abort signal that expires after its configured timeout", async () => {
  const signal = createTranscriptionAbortSignal(10);

  assert.equal(signal.aborted, false);

  const timeoutReason = await new Promise<DOMException>((resolve, reject) => {
    const safetyTimer = setTimeout(() => {
      reject(new Error("Abort signal did not expire within the expected time."));
    }, 1000);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(safetyTimer);
        resolve(signal.reason as DOMException);
      },
      { once: true },
    );
  });

  assert.equal(signal.aborted, true);
  assert.equal(timeoutReason.name, "TimeoutError");
});