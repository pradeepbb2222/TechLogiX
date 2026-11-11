
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { Card } from "./Card";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

const SUGGESTIONS = [
  "Wireless headphones under $100",
  "Smartphone under $500",
  "Laptop under $700",
];

export function ChatPanel({
  messages,
  busy,
  onSend,
  userInitial,
}: {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string) => void;
  userInitial: string;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { isRecording, isTranscribing, errorMessage, startRecording, stopRecording, clearError } =
    useAudioRecorder();

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages, busy]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    onSend(v);
    setText("");
  };

  const handleMicClick = async () => {
    clearError();
    if (isRecording) {
      const transcript = await stopRecording();
      if (transcript) setText(transcript);
    } else {
      await startRecording();
    }
  };

  const micDisabled = busy || isTranscribing;

  return (
    <Card
      title="Shopping assistant"
      action={
        <span className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {busy ? "Working" : "Ready"}
        </span>
      }
      className="overflow-hidden"
    >

      {/* Assistant identity */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">
            CogniCart AI
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Your personal product discovery and comparison assistant
          </p>
        </div>

        <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:inline-block">
          Shopping agent
        </span>
      </div>


      {/* Conversation */}
      <div
        className="my-4 max-h-[330px] min-h-[170px] space-y-4 overflow-y-auto rounded-xl border border-slate-100 bg-[#f8fafc] p-4 sm:p-5"
        aria-live="polite"
        aria-label="Shopping conversation"
        role="log"
      >
        {messages.length === 0 && (
          <div className="flex min-h-[155px] flex-col justify-center">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M4 5h16v12H9l-5 3V5Z" />
                <path d="M8 9h8m-8 4h5" />
              </svg>
            </div>

            <h4 className="text-sm font-bold text-slate-900">
              What would you like to find?
            </h4>

            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              Describe the product, features and budget you&apos;re looking for.
              I&apos;ll help you discover and compare suitable options.
            </p>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === "user";

          return (
            <div
              key={m.id}
              className={`flex items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"
                }`}
            >
              {!isUser && (
                <div
                  className="h-8 w-8 shrink-0 rounded-lg border border-slate-100 bg-white"
                  role="img"
                  aria-label="CogniCart robot"
                  style={{
                    backgroundImage: "url('/branding/cognicart-logo.png')",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "auto 100%",
                    backgroundPosition: "left center",
                  }}
                />
              )}

              <div
                className={`max-w-[88%] rounded-xl px-4 py-3 text-[13px] leading-6 ${isUser
                    ? "rounded-br-sm bg-blue-600 text-white"
                    : "rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
                  }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {m.text}
                </p>
              </div>

              {isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-sm">
                  {userInitial}
                </div>
              )}
            </div>
          );
        })}

        {busy && (
          <div className="flex items-end gap-2.5">
            <div
              className="h-8 w-8 shrink-0 rounded-lg border border-slate-100 bg-white"
              role="img"
              aria-label="CogniCart robot"
              style={{
                backgroundImage: "url('/branding/cognicart-logo.png')",
                backgroundRepeat: "no-repeat",
                backgroundSize: "auto 100%",
                backgroundPosition: "left center",
              }}
            />

            <div className="rounded-xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600" />
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Comparing products...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Suggested prompts */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Suggested searches
          </p>
          <span className="text-[10px] text-slate-400">
            Select to get started
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => submit(s)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form
        className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-1.5 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Describe the product you're looking for..."
          aria-label="Shopping request"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
        />

        <button
          type="button"
          onClick={handleMicClick}
          disabled={micDisabled}
          aria-label={
            isRecording
              ? "Stop recording"
              : isTranscribing
                ? "Transcribing..."
                : "Start voice input"
          }
          title={
            isRecording
              ? "Stop recording"
              : isTranscribing
                ? "Transcribing..."
                : "Voice input"
          }
          className={`flex items-center justify-center rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${isRecording
              ? "animate-pulse border-red-400 bg-red-50 text-red-600 hover:bg-red-100"
              : "border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
        >
          {isTranscribing ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : isRecording ? (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0014 0" />
              <line x1="12" y1="20" x2="12" y2="17" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        <span className="hidden shrink-0 text-[10px] tabular-nums text-slate-400 sm:block">
          {text.length}/500
        </span>

        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Send shopping request"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="m5 12 14-7-4 14-3-6-7-1Z" />
            <path d="m12 13 7-8" />
          </svg>
        </button>
      </form>

      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <p className="mt-3 text-center text-[10px] text-slate-400">
        Every purchase requires your explicit approval.
      </p>

    </Card>
  );
}
