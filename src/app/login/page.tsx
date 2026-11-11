
"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* Left branding panel */}
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#101b35] p-12 text-white lg:flex xl:p-16">
        <div className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10">

<div className="mt-8 flex w-fit flex-col items-center gap-2">
  <Image
    src="/branding/cognicart-logo.png"
    alt="CogniCart"
    width={300}
    height={120}
    priority
    className="h-auto w-[180px] rounded-2xl object-contain shadow-md shadow-black/10"
  />

  <p className="whitespace-nowrap text-[11px] font-medium tracking-[0.08em] text-blue-100/90">
    Shop with Ease. Pay with Peace.
  </p>
</div>


          <div className="mt-16 max-w-xl">
            <h1 className="text-4xl font-semibold leading-[1.2] tracking-tight xl:text-5xl">
              Shopping smarter.
              <br />
              <span className="text-blue-400">
                Paying with confidence.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
              Meet your AI-powered shopping assistant. Discover products,
              compare options, and let intelligent automation handle the
              research while you stay in control of every payment.
            </p>
          </div>

          {/* Product workflow visual */}
          <div className="mt-14 max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                Your shopping workflow
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                CONTROLLED BY YOU
              </span>
            </div>

            <div className="space-y-4">
              {[
                {
                  number: "01",
                  title: "Understand your needs",
                  detail: "AI interprets your shopping request",
                },
                {
                  number: "02",
                  title: "Discover and compare",
                  detail: "Find products that match your requirements",
                },
                {
                  number: "03",
                  title: "Approve your payment",
                  detail: "You stay in control before checkout",
                },
              ].map((step, index) => (
                <div key={step.number} className="flex items-center gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-400/10 text-xs font-bold text-blue-300">
                    {step.number}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
          <span>© 2026 CogniCart</span>
          <span>AI-powered E-commerce platform</span>
        </div>
      </section>


      {/* Right sign-in panel */}
      <section className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-gradient-to-br from-[#f1f4ff] via-[#f8faff] to-[#eef2ff] px-6 py-8 sm:px-12 lg:px-16 xl:px-24">

        {/* Ambient background effects */}
        <div className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-indigo-300/25 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-blue-300/25 blur-[100px]" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-64 w-64 rounded-full bg-violet-200/20 blur-[90px]" />

        {/* Mobile brand */}
        <div className="relative z-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/25">
            A
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            CogniCart
          </span>
        </div>

        {/* Login content */}
        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16">

          <div className="mb-9">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
                Your intelligent shopping workspace
              </span>
            </div>

            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[40px]">
              Welcome to
              <span className="block bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 bg-clip-text text-transparent">
                CogniCart.
              </span>
            </h2>

            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">
              Discover smarter shopping, compare products intelligently,
              and stay in control of every payment.
            </p>
          </div>

          {/* Login card */}
          <div className="rounded-3xl border border-white/80 bg-white/85 p-7 shadow-[0_20px_70px_-25px_rgba(79,70,229,0.22)] backdrop-blur-xl sm:p-9">

            <div className="mb-7">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 text-indigo-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42m-9.88 9.88-1.42 1.42"
                  />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>

              <h3 className="text-lg font-bold tracking-tight text-slate-900">
                Sign in to your account
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Continue securely using your Google account.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="group flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-lg hover:shadow-indigo-100/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="3"
                      opacity=".25"
                    />
                    <path
                      d="M21 12a9 9 0 0 0-9-9"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Connecting to Google...
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 48 48"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.02 13.22l7.98 6.19C11.92 13.72 17.49 9.5 24 9.5Z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.73 7.18l7.73 6C44.45 37.98 46.98 31.8 46.98 24.55Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.56l7.98-6.19Z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.92-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.19 2.3-6.6 0-12.08-4.22-14-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
                    />
                  </svg>
                  Continue with Google
                  <span className="ml-auto text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500">
                    →
                  </span>
                </>
              )}
            </button>

            {error && (
              <p
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Secure authentication
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Security information */}
            <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-blue-50/70 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3 5 6v5c0 4.5 2.9 8.2 7 10 4.1-1.8 7-5.5 7-10V6l-7-3Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m9 12 2 2 4-4"
                  />
                </svg>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-800">
                  Your account stays protected
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">
                  Authentication is securely handled by Supabase.
                  CogniCart never asks for your Google password.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-7 text-center text-xs leading-6 text-slate-500">
            By continuing, you agree to use CogniCart responsibly.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-center gap-2 border-t border-indigo-100/80 pt-5 text-xs text-slate-500">
          <span>© 2026 CogniCart</span>
          <span className="text-indigo-300">·</span>
          <span>Secure AI-powered shopping</span>
        </div>
      </section>

    </main>
  );
}
