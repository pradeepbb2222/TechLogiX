import { NextResponse } from "next/server";
import { APICallError } from "ai";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import {
  transcribeAudio,
  isSupportedAudioMimeType,
  MAX_AUDIO_BYTES,
} from "@/lib/transcribe";
import { checkTranscriptionRateLimit } from "@/lib/transcribe-rate-limit";
import { readLimitedFormData } from "@/lib/limited-form-data";
import { isAudioSignatureMatchingMimeType } from "@/lib/audio-signature";

type TranscribeDependencies = {
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
};

export async function handleTranscribeRequest(
  request: Request,
  dependencies: TranscribeDependencies,
) {
  try {
    const user = await dependencies.authenticate();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    let rateLimit;

    try {
      rateLimit = await dependencies.checkRateLimit(user.id);
    } catch (error) {
      console.error("Transcription rate-limit check failed:", error);

      return NextResponse.json(
        {
          error:
            "Transcription service temporarily unavailable. Please try again.",
        },
        { status: 503 },
      );
    }

    if (!rateLimit.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1000),
      );

      return NextResponse.json(
        {
          error:
            "Too many transcription requests. Please try again shortly.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }

    const bodyResult = await readLimitedFormData(request);

    if (!bodyResult.ok) {
      return NextResponse.json(
        { error: bodyResult.error },
        { status: bodyResult.status },
      );
    }

    const file = bodyResult.formData.get("audio");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            'No audio file provided. Send the recording under the "audio" field.',
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Audio recording is empty." },
        { status: 400 },
      );
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Audio file exceeds maximum size limit (10 MB)." },
        { status: 413 },
      );
    }

    const mimeType = file.type
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!mimeType || !isSupportedAudioMimeType(mimeType)) {
      return NextResponse.json(
        {
          error: `Unsupported audio format: ${mimeType || "unknown"}. Accepted: audio/mp4, audio/webm, audio/wav, audio/mpeg, audio/ogg, audio/aac.`,
        },
        { status: 415 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!isAudioSignatureMatchingMimeType(buffer, mimeType)) {
      return NextResponse.json(
        {
          error:
            "Audio content does not match the declared file format.",
        },
        { status: 415 },
      );
    }

    const { text } = await dependencies.transcribe(buffer, mimeType);

    return NextResponse.json({ text });
  } catch (error) {
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      const retryAfter = Object.entries(error.responseHeaders ?? {})
        .find(([name]) => name.toLowerCase() === "retry-after")?.[1]
        ?.trim();

      const headers: Record<string, string> = {};

      if (
        retryAfter &&
        /^\d+$/.test(retryAfter) &&
        Number.isSafeInteger(Number(retryAfter))
      ) {
        headers["Retry-After"] = retryAfter;
      }

      console.warn("Transcription provider rate limit reached.");

      return NextResponse.json(
        {
          error:
            "The transcription service is temporarily rate-limited. Please try again shortly.",
        },
        {
          status: 429,
          headers,
        },
      );
    }

    console.error("Transcribe API error:", error);

    return NextResponse.json(
      { error: "Unable to transcribe audio. Please try again." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleTranscribeRequest(request, {
    authenticate: getAuthenticatedUser,
    checkRateLimit: checkTranscriptionRateLimit,
    transcribe: transcribeAudio,
  });
}
