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

  // Package audio as a typed Data URL so the @ai-sdk/google adapter and the
  // Gemini Interactions API both receive the exact MIME type rather than
  // relying on binary-header sniffing (which falls back to audio/wav for
  // unknown signatures such as the M4A/MP4 container).
  const normalizedMimeType = mimeType.split(";")[0].trim();

  const audioInput = new URL(
    `data:${normalizedMimeType};base64,${audioBuffer.toString("base64")}`,
  );

  const model = google.transcriptionModel("gemini-3.5-transcribe");

  const result = await transcribe({
    model,
    audio: audioInput,
    maxRetries: 0,
  });

  return { text: result.text ? result.text.trim() : "" };
}
