"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { Card } from "./Card";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

const SUGGESTIONS = ["Wireless headphones under $100", "Running shoes under $90", "Laptop under $700"];

export function ChatPanel({ messages, busy, onSend }: { messages: ChatMessage[]; busy: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { isRecording, isTranscribing, errorMessage, startRecording, stopRecording, clearError } =
    useAudioRecorder();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    <Card title="Shopping Assistant" className="flex flex-col">
      <div className="h-72 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-slate-500">Agent is comparing products…</div>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => submit(s)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="What should I buy?"
          aria-label="Shopping request"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="button"
          onClick={handleMicClick}
          disabled={micDisabled}
          aria-label={isRecording ? "Stop recording" : isTranscribing ? "Transcribing…" : "Start voice input"}
          title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing…" : "Voice input"}
          className={`flex items-center justify-center rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
            isRecording
              ? "animate-pulse border-red-400 bg-red-50 text-red-600 hover:bg-red-100"
              : "border-slate-300 text-slate-600 hover:bg-slate-100"
          }`}
        >
          {isTranscribing ? (
            /* Spinner */
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : isRecording ? (
            /* Stop icon */
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            /* Microphone icon */
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0014 0" />
              <line x1="12" y1="20" x2="12" y2="17" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
        <button type="submit" disabled={busy || !text.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          Send
        </button>
      </form>
      {errorMessage && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </Card>
  );
}
