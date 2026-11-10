
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { Card } from "./Card";

const SUGGESTIONS = [
  "Wireless headphones under $100",
  "Smartphone under $500",
  "Laptop under $700",
];

export function ChatPanel({
  messages,
  busy,
  onSend,
}: {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#172554] text-white">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
            <circle cx="12" cy="12" r="5" />
            <path d="m8.5 8.5 7 7m0-7-7 7" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold text-slate-900">
            AgentFlow AI
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
              Describe the product, features and budget you're looking for.
              I'll help you discover and compare suitable options.
            </p>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === "user";

          return (
            <div
              key={m.id}
              className={`flex items-end gap-2.5 ${
                isUser ? "justify-end" : "justify-start"
              }`}
            >
              {!isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#172554] text-[9px] font-bold text-white">
                  AF
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-xl px-4 py-3 text-[13px] leading-6 ${
                  isUser
                    ? "rounded-br-sm bg-blue-600 text-white"
                    : "rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {m.text}
                </p>
              </div>

              {isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-[9px] font-bold text-slate-600">
                  YOU
                </div>
              )}
            </div>
          );
        })}

        {busy && (
          <div className="flex items-end gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#172554] text-[9px] font-bold text-white">
              AF
            </div>

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

      <p className="mt-3 text-center text-[10px] text-slate-400">
        Every purchase requires your explicit approval.
      </p>
    </Card>
  );
}
