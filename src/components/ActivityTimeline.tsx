import type { TimelineEvent } from "@/lib/types";
import { Card } from "./Card";

const TONES: Record<TimelineEvent["tone"], string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card title="Agent Activity">
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">Agent actions will appear here.</p>
      ) : (
        <ol className="max-h-80 space-y-4 overflow-y-auto border-l border-slate-200 pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${TONES[e.tone]}`} />
              <p className="text-sm font-medium text-slate-900">{e.title}</p>
              {e.detail && <p className="text-xs text-slate-600">{e.detail}</p>}
              <time className="text-[11px] text-slate-400" dateTime={e.createdAt} suppressHydrationWarning>
                {new Date(e.createdAt).toLocaleTimeString()}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
