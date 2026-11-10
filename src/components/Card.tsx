
import type { ReactNode } from "react";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_4px_18px_rgba(15,23,42,0.06)] sm:p-6 ${className}`}
    >
      <div className="mb-5 flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 text-sm font-bold tracking-tight text-slate-900 sm:text-base">
          {title}
        </h2>

        {action && (
          <div className="shrink-0">
            {action}
          </div>
        )}
      </div>

      {children}
    </section>
  );
}

export const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
