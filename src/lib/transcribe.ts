import { transcribe } from "ai";
import { google } from "@ai-sdk/google";

const SUPPORTED_MIME_TYPES = new Set([
  "audio/mp4",
  "audio/webm",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/aac",
]);

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
export const TRANSCRIPTION_TIMEOUT_MS = 30_000;

export function createTranscriptionAbortSignal(
  timeoutMs = TRANSCRIPTION_TIMEOUT_MS,
): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

export function isSupportedAudioMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType);
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<{ text: string }> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured.");
  }

  // Preserve the exact MIME type for the Gemini transcription model.
  const normalizedMimeType = mimeType.split(";")[0].trim();

  const audioInput = new URL(
    `data:${normalizedMimeType};base64,${audioBuffer.toString("base64")}`,
  );

  const model = google.transcriptionModel("gemini-3.5-transcribe");

  const result = await transcribe({
    model,
    audio: audioInput,
    maxRetries: 0,
    abortSignal: createTranscriptionAbortSignal(),
  });

  return { text: result.text ? result.text.trim() : "" };
}
