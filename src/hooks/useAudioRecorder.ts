"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  clearError: () => void;
}

/** Ordered list of MIME types to try with MediaRecorder. The first supported
 *  type is used for the recording session and sent to the transcription API. */
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm"; // Let the browser decide; recorder will throw if truly unsupported.
}

/**
 * Returns the base MIME type (strip codec parameters) so it matches the
 * whitelist on the API route (e.g. "audio/webm;codecs=opus" → "audio/webm").
 */
function baseMimeType(fullType: string): string {
  return fullType.split(";")[0].trim();
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  /** M1: Tracks whether the hook's owner component is still mounted. */
  const isMountedRef = useRef(true);
  /** M2: Prevents concurrent getUserMedia() calls from opening multiple streams. */
  const isAcquiringRef = useRef(false);

  /** Stop all microphone tracks and release the stream. */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearError = useCallback(() => setErrorMessage(null), []);

  // M1: Stop the recorder and release microphone tracks when the component
  // unmounts. Also marks the hook as unmounted so async continuations
  // (onstop, fetch) skip state updates on the now-gone component.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      releaseStream();
    };
  }, [releaseStream]);

  const startRecording = useCallback(async () => {
    // M2: Block re-entry while a getUserMedia() request is already in flight.
    if (isAcquiringRef.current) return;
    setErrorMessage(null);

    // Guard: MediaRecorder is a browser-only API.
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setErrorMessage("Audio recording is not supported in this browser.");
      return;
    }

    isAcquiringRef.current = true; // M2: hold guard while awaiting getUserMedia
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      isAcquiringRef.current = false; // M2: release on failure
      if (!isMountedRef.current) return; // M1: component gone, skip state updates
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setErrorMessage(
          "Microphone access was denied. Please allow microphone permission and try again.",
        );
      } else if (
        err instanceof DOMException &&
        err.name === "NotFoundError"
      ) {
        setErrorMessage("No microphone was found on this device.");
      } else {
        setErrorMessage("Could not access microphone. Please try again.");
      }
      return;
    }

    isAcquiringRef.current = false; // M2: release after stream is acquired

    // M1: If the component unmounted while getUserMedia was pending, discard
    // the stream immediately so the microphone indicator stops in the browser.
    if (!isMountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];
    streamRef.current = stream;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      // Fall back to browser default if the chosen type is rejected at runtime.
      recorder = new MediaRecorder(stream);
      mimeTypeRef.current = recorder.mimeType || "audio/webm";
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250); // Collect data every 250 ms.
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state === "inactive") {
        releaseStream();
        setIsRecording(false);
        resolve("");
        return;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        releaseStream();

        const chunks = chunksRef.current;
        chunksRef.current = [];

        if (chunks.length === 0) {
          setErrorMessage("Recording was empty. Please try again.");
          resolve("");
          return;
        }

        const mimeType = mimeTypeRef.current;
        const blob = new Blob(chunks, { type: mimeType });

        if (blob.size === 0) {
          setErrorMessage("Recording was empty. Please try again.");
          resolve("");
          return;
        }

        // Send to the transcription API.
        setIsTranscribing(true);
        try {
          const form = new FormData();
          // Use the base MIME type (without codec params) for the filename
          // extension hint, but the Blob carries the full type for the API.
          const extension = baseMimeType(mimeType).split("/")[1] ?? "webm";
          form.append("audio", blob, `recording.${extension}`);

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const message =
              typeof body?.error === "string"
                ? body.error
                : `Transcription failed (HTTP ${response.status}).`;
            setErrorMessage(message);
            resolve("");
            return;
          }

          const data = await response.json();
          const transcript: string =
            typeof data?.text === "string" ? data.text : "";

          if (!transcript) {
            setErrorMessage(
              "No speech detected. Please speak clearly and try again.",
            );
          }

          resolve(transcript);
        } catch {
          setErrorMessage(
            "Network error while transcribing. Please check your connection and try again.",
          );
          resolve("");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.stop();
    });
  }, [releaseStream]);

  return {
    isRecording,
    isTranscribing,
    errorMessage,
    startRecording,
    stopRecording,
    clearError,
  };
}
