import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_REQUEST_BYTES,
  readLimitedFormData,
} from "../src/lib/limited-form-data";

test("rejects a declared content length above the limit before parsing", async () => {
  const request = new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=test",
      "content-length": String(MAX_REQUEST_BYTES + 1),
    },
    body: "--test--",
  });

  const result = await readLimitedFormData(request);

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.status, 413);
  }
});

test("rejects an invalid content length", async () => {
  const request = new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=test",
      "content-length": "not-a-number",
    },
    body: "--test--",
  });

  const result = await readLimitedFormData(request);

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.status, 400);
  }
});

test("accepts a valid multipart form within the body limit", async () => {
  const formData = new FormData();
  formData.append(
    "audio",
    new Blob(["small audio test payload"], { type: "audio/webm" }),
    "recording.webm",
  );

  const request = new Request("http://localhost/api/transcribe", {
    method: "POST",
    body: formData,
  });

  const result = await readLimitedFormData(request);

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.formData.get("audio") instanceof File, true);
  }
});

test("rejects an actual body larger than the limit", async () => {
  const oversizedPayload = new Uint8Array(MAX_REQUEST_BYTES + 1);

  const request = new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
    },
    body: oversizedPayload,
  });

  const result = await readLimitedFormData(request);

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.status, 413);
  }
});
