
import type { TimelineEvent } from "@/lib/types";
import { Card } from "./Card";

const TONES: Record<TimelineEvent["tone"], string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

const TONE_STYLES: Record<TimelineEvent["tone"], string> = {
  info: "bg-blue-50 text-blue-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  error: "bg-red-50 text-red-600",
};

export function ActivityTimeline({
  events,
}: {
  events: TimelineEvent[];
}) {
  return (
    <Card
      title="Agent activity"
      action={
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          ACTIVITY FEED
        </span>
      }
    >
      {events.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-slate-200">
            ◷
          </div>

          <h3 className="mt-4 text-sm font-bold text-slate-800">
            Waiting for activity
          </h3>

          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
            Your agent&apos;s actions, product searches and payment updates
            will appear here.
          </p>
        </div>
      ) : (
        <ol className="max-h-[360px] space-y-0 overflow-y-auto pr-2">
          {events.map((e, index) => (
            <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
              <div className="relative flex w-8 shrink-0 justify-center">
                {index !== events.length - 1 && (
                  <span className="absolute top-7 bottom-0 w-px bg-slate-200" />
                )}

                <span
                  className={`relative z-10 mt-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${TONE_STYLES[e.tone]}`}
                >
                  <span className={`h-2 w-2 rounded-full ${TONES[e.tone]}`} />
                </span>
              </div>

              <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-slate-200 hover:bg-slate-50/70">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-bold leading-5 text-slate-800">
                    {e.title}
                  </p>

                  <time
                    className="shrink-0 text-[10px] font-medium text-slate-400"
                    dateTime={e.createdAt}
                    suppressHydrationWarning
                  >
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </time>
                </div>

                {e.detail && (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {e.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
