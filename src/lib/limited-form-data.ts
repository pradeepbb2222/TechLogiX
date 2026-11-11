import { MAX_AUDIO_BYTES } from "@/lib/transcribe";

export const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024;

export type LimitedFormDataResult =
  | { ok: true; formData: FormData }
  | { ok: false; status: 400 | 413; error: string };

export async function readLimitedFormData(
  request: Request,
): Promise<LimitedFormDataResult> {
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return {
        ok: false,
        status: 400,
        error: "Invalid Content-Length header.",
      };
    }

    const declaredLength = Number(contentLength);

    if (!Number.isSafeInteger(declaredLength)) {
      return {
        ok: false,
        status: 400,
        error: "Invalid Content-Length header.",
      };
    }

    if (declaredLength > MAX_REQUEST_BYTES) {
      return {
        ok: false,
        status: 413,
        error: "Request body exceeds the maximum allowed size.",
      };
    }
  }

  if (!request.body) {
    return {
      ok: false,
      status: 400,
      error: "Request body is missing.",
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_REQUEST_BYTES) {
        await reader.cancel();

        return {
          ok: false,
          status: 413,
          error: "Request body exceeds the maximum allowed size.",
        };
      }

      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Unable to read request body.",
    };
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const formData = await new Response(body, {
      headers: request.headers,
    }).formData();

    return { ok: true, formData };
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid multipart request body.",
    };
  }
}
