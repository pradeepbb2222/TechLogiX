import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import {
  transcribeAudio,
  isSupportedAudioMimeType,
  MAX_AUDIO_BYTES,
} from "@/lib/transcribe";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const file = formData.get("audio");

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

    // Normalize MIME type: strip codec parameters (e.g. "audio/webm;codecs=opus"
    // → "audio/webm") before validating against the accepted-formats whitelist.
    const mimeType = (file.type || "audio/webm").split(";")[0].trim();

    if (!isSupportedAudioMimeType(mimeType)) {
      return NextResponse.json(
        {
          error: `Unsupported audio format: ${mimeType}. Accepted: audio/mp4, audio/webm, audio/wav, audio/mpeg, audio/ogg, audio/aac.`,
        },
        { status: 415 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { text } = await transcribeAudio(buffer, mimeType);

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Transcribe API error:", error);
    return NextResponse.json(
      { error: "Unable to transcribe audio. Please try again." },
      { status: 500 },
    );
  }
}
