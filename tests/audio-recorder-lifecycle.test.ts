import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: dom.window,
});

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: dom.window.document,
});

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  writable: true,
  value: true,
});

class MockMediaRecorder {
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;

  static isTypeSupported(type: string) {
    return type === "audio/webm";
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.ondataavailable?.({
      data: new Blob(["mock audio"], { type: this.mimeType }),
    } as BlobEvent);

    this.state = "inactive";
    this.onstop?.();
  }
}

const originalMediaRecorder = globalThis.MediaRecorder;
const originalFetch = globalThis.fetch;
const originalMediaDevices = navigator.mediaDevices;

function installMockMicrophone() {
  let tracksStopped = 0;

  const track = {
    stop() {
      tracksStopped += 1;
    },
  };

  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream;

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => stream,
    },
  });

  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: MockMediaRecorder as unknown as typeof MediaRecorder,
  });

  return {
    get tracksStopped() {
      return tracksStopped;
    },
  };
}

test("unmounting while recording stops the recorder and releases microphone tracks", async () => {
  const microphone = installMockMicrophone();

  const { result, unmount } = renderHook(() => useAudioRecorder());

  await act(async () => {
    await result.current.startRecording();
  });

  assert.equal(result.current.isRecording, true);
  assert.equal(microphone.tracksStopped, 0);

  unmount();

  assert.equal(microphone.tracksStopped, 1);
});

test("unmounting while transcribing aborts the pending fetch", async () => {
  installMockMicrophone();

  const request: { signal?: AbortSignal } = {};

  globalThis.fetch = (async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;

      assert.ok(signal, "Transcription fetch should receive an AbortSignal");

      request.signal = signal;

      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  }) as typeof fetch;

  const { result, unmount } = renderHook(() => useAudioRecorder());

  await act(async () => {
    await result.current.startRecording();
  });

  let transcriptionPromise!: Promise<string>;

  await act(async () => {
    transcriptionPromise = result.current.stopRecording();
    await Promise.resolve();
  });

  assert.ok(request.signal, "Transcription request should have started");
  assert.equal(request.signal.aborted, false);

  unmount();

  assert.equal(
    request.signal.aborted,
    true,
    "Unmounting should abort the transcription request",
  );

  assert.equal(await transcriptionPromise, "");
});

after(() => {
  globalThis.fetch = originalFetch;

  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: originalMediaRecorder,
  });

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: originalMediaDevices,
  });

  dom.window.close();
});