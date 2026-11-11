
"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAgentFlowContext } from "@/providers/AgentFlowProvider";

const NAV_ITEMS = [
  { label: "Shopping assistant", href: "/", icon: "✳" },
  { label: "Product results", href: "/results", icon: "⌕" },
  { label: "Checkout", href: "/checkout", icon: "⇄" },
  { label: "Transactions", href: "/transactions", icon: "▤" },
  { label: "Settings", href: "/settings", icon: "⚙" },
];

export default function WorkspaceShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { userEmail } = useAgentFlowContext();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setLogoutError(error.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href;
  }

  const currentPage =
    NAV_ITEMS.find((item) => isActive(item.href))?.label ?? "Workspace";

  return (
    <div className="min-h-screen bg-[#f3f6fc] text-slate-900">

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/10 bg-[#111827] text-white lg:flex">

        {/* Brand */}
        <div className="flex h-[120px] items-center px-5 pt-10">
  <div className="flex flex-col items-start gap-1">
    <Image
      src="/branding/cognicart-logo.png"
      alt="CogniCart"
      width={300}
      height={120}
      priority
      className="h-auto w-[155px] rounded-xl object-contain"
    />
    <p className="pl-1 text-[9px] font-medium tracking-wide text-slate-400">
      Shop with Ease. Pay with Peace.
    </p>
  </div>
</div>

        {/* Navigation */}
        <div className="px-4 pt-9">
          <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Main workspace
          </p>

          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3.5 py-3.5 text-[13px] font-semibold transition-all duration-200 ${
                  isActive(item.href)
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-950/40"
                    : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition ${
                    isActive(item.href)
                      ? "bg-white/15 text-white"
                      : "bg-white/[0.05] text-slate-400 group-hover:bg-white/10 group-hover:text-white"
                  }`}
                >
                  {item.icon}
                </span>

                <span>{item.label}</span>

                {isActive(item.href) && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom account area */}
        <div className="mt-auto space-y-5 border-t border-white/[0.08] p-4">

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] p-3.5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-sm font-bold text-white">
                {userEmail.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-medium text-slate-400">
                  Signed in as
                </p>
                <p className="mt-1 truncate text-[11px] font-semibold text-white">
                  {userEmail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-white/[0.08] pt-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.6)]" />
              <span className="text-[10px] font-medium text-slate-400">
                Account connected
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-amber-400/[0.08] px-3 py-2.5">
            <span className="text-[10px] font-bold tracking-wide text-amber-300">
              PAYPAL SANDBOX
            </span>
            <span className="h-2 w-2 rounded-full bg-amber-400" />
          </div>

          <p className="px-2 text-[9px] text-slate-600">
            CogniCart · Intelligent E-commerce
          </p>
        </div>
      </aside>

      {/* Main application */}
      <div className="min-h-screen lg:ml-[260px]">

        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/30 backdrop-blur-xl">
          <div className="flex min-h-[82px] items-center justify-between gap-4 px-5 sm:px-8">

            {/* Mobile brand */}
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 font-black text-white shadow-md">
                C
              </div>
              <span className="text-lg font-extrabold tracking-tight">
                CogniCart
              </span>
            </div>

            {/* Page title */}
            <div className="hidden lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                CogniCart / Workspace
              </p>
              <h1 className="mt-1 text-[17px] font-bold tracking-tight text-slate-900">
                {currentPage}
              </h1>
            </div>

            {/* Header actions */}
            <div className="ml-auto flex items-center gap-3">

              <span className="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-[10px] font-bold tracking-wide text-amber-700 sm:flex">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                SANDBOX MODE
              </span>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>

          {/* Mobile navigation */}
          <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-3 lg:hidden">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3.5 py-2.5 text-[11px] font-bold transition ${
                  isActive(item.href)
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {logoutError && (
            <p role="alert" className="px-8 pb-3 text-xs text-red-600">
              Logout failed: {logoutError}
            </p>
          )}
        </header>

        {/* Page content */}
        <main className="mx-auto min-h-[calc(100vh-82px)] max-w-[1600px] px-4 py-7 sm:px-7 lg:px-9 lg:py-9">
          {children}

          <footer className="mt-14 border-t border-slate-200/80 py-7">
            <div className="flex flex-col justify-between gap-2 text-[10px] font-medium text-slate-400 sm:flex-row">
              <span>© CogniCart · Intelligent E-commerce platform</span>
              <span>Secure shopping · User-approved payments</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
