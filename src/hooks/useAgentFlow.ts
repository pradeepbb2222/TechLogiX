"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  PaymentResponse,
  PaymentStatus,
  Product,
  SearchResponse,
  TimelineEvent,
  Transaction,
} from "@/lib/types";
import { CHECKOUT_CONTEXT_KEY } from "@/lib/checkout-context";

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const POLL_PROCESSING_MS = 10_000;

interface CheckoutContext {
  products: Product[];
  recommendedId: string | null;
  selectedId: string | null;
  spendingLimit: number;
}

export function useAgentFlow() {
  const [spendingLimit, setSpendingLimit] = useState(150);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      // Static id/timestamp: no random or time values during prerender.
      id: "welcome",
      role: "agent",
      text: "Hi! I'm AgentFlow. Tell me what to buy and your budget, e.g. \"wireless headphones under $100\". I'll compare options and ask for your approval before any payment.",
      createdAt: "",
    },
  ]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Only ever contains server-persisted transactions. Pre-order events go to the timeline instead.
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("not_started");
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const approving = useRef(false); // blocks repeated clicks while an order is being created

  const log = useCallback((title: string, tone: TimelineEvent["tone"], detail?: string) => {
    setEvents((prev) => [{ id: uid(), title, detail, tone, createdAt: now() }, ...prev]);
  }, []);

  const refreshTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { transactions?: Transaction[] };
      if (data.transactions) setTransactions(data.transactions);
    } catch {
      // Keep showing the last known server state.
    }
  }, []);

  // Restore the shopping context saved before the PayPal redirect (this browser tab only).
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(CHECKOUT_CONTEXT_KEY);
        if (!raw) return;
        const ctx = JSON.parse(raw) as Partial<CheckoutContext>;
        if (!Array.isArray(ctx.products) || ctx.products.length === 0) return;
        setProducts(ctx.products);
        setRecommendedId(ctx.recommendedId ?? null);
        if (typeof ctx.spendingLimit === "number") setSpendingLimit(ctx.spendingLimit);
        if (ctx.selectedId && ctx.products.some((p) => p.id === ctx.selectedId)) {
          setSelectedId(ctx.selectedId);
          // A fresh checkout always needs a fresh explicit approval.
          setPaymentStatus("awaiting_approval");
        }
        setEvents((prev) => [{ id: uid(), title: "Restored your shopping context", tone: "info", createdAt: now() }, ...prev]);
      } catch {
        sessionStorage.removeItem(CHECKOUT_CONTEXT_KEY);
      }
    });
  }, []);

  // Load history on mount; refresh when the tab regains focus or is restored from the back/forward cache.
  useEffect(() => {
    void refreshTransactions();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshTransactions();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      approving.current = false;
      setPaymentStatus((s) => (s === "processing" ? "awaiting_approval" : s));
      setPaymentMessage(null);
      void refreshTransactions();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refreshTransactions]);

  // Poll only while a payment is mid-verification, and stop as soon as none is.
  const hasProcessing = transactions.some((t) => t.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const id = setInterval(() => void refreshTransactions(), POLL_PROCESSING_MS);
    return () => clearInterval(id);
  }, [hasProcessing, refreshTransactions]);

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const spent = transactions.filter((t) => t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(0, spendingLimit - spent);

  const sendMessage = useCallback(
    async (text: string) => {
      setMessages((m) => [...m, { id: uid(), role: "user", text, createdAt: now() }]);
      setIsSearching(true);
      setPaymentStatus("not_started");
      setPaymentMessage(null);
      setSelectedId(null);
      log("Received request", "info", text);
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, spendingLimit }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Request failed");
        const data = (await res.json()) as SearchResponse;
        setProducts(data.products);
        setRecommendedId(data.recommendedId);
        setSelectedId(data.recommendedId);
        setMessages((m) => [...m, { id: uid(), role: "agent", text: data.reply, createdAt: now() }]);
        if (data.parsedBudget !== null) log("Budget detected", "info", `$${data.parsedBudget.toFixed(2)}`);
        log(
          data.products.length ? "Compared products" : "No matching products",
          data.products.length ? "success" : "warning",
          data.products.length ? `${data.products.length} option(s) ranked` : undefined,
        );
        if (data.recommendedId) {
          setPaymentStatus("awaiting_approval");
          log("Awaiting your approval", "warning", "Select a product and approve to continue");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setMessages((m) => [...m, { id: uid(), role: "agent", text: `Sorry, something went wrong: ${msg}`, createdAt: now() }]);
        log("Search failed", "error", msg);
      } finally {
        setIsSearching(false);
      }
    },
    [log, spendingLimit],
  );

  const selectProduct = useCallback((id: string) => {
    setSelectedId(id);
    setPaymentStatus("awaiting_approval");
    setPaymentMessage(null);
  }, []);

  const approve = useCallback(async () => {
    if (!selected || paymentStatus !== "awaiting_approval" || approving.current) return;
    if (selected.price > spendingLimit) {
      setPaymentStatus("failed");
      setPaymentMessage("This item exceeds your spending limit.");
      log("Blocked: over limit", "error", selected.name);
      return;
    }
    approving.current = true;
    setPaymentStatus("processing");
    setPaymentMessage("Creating a PayPal Sandbox order…");
    log("Approval granted", "success", selected.name);
    log("Creating PayPal Sandbox order", "info");

    // Failures before an order exists are timeline events only, never history rows.
    const fail = (message: string) => {
      approving.current = false;
      setPaymentStatus("failed");
      setPaymentMessage(message);
      log("Checkout could not be started", "error", message);
    };

    try {
      const res = await fetch("/api/paypal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selected.id, spendingLimit, approved: true }),
      });
      const data = (await res.json()) as PaymentResponse & { approveUrl?: string };
      if (!res.ok || !data.approveUrl) {
        fail(data.message || "Could not create the PayPal order.");
        return;
      }
      // Keep the shopping context so the user can return to it after PayPal (tab-local storage).
      const ctx: CheckoutContext = { products, recommendedId, selectedId: selected.id, spendingLimit };
      try {
        sessionStorage.setItem(CHECKOUT_CONTEXT_KEY, JSON.stringify(ctx));
      } catch {
        // Storage may be unavailable; checkout still works.
      }
      // Status is only ever confirmed by the server after PayPal capture (see /payment/return).
      log("Redirecting to PayPal Sandbox", "info", "Approve the payment with your Sandbox buyer account");
      window.location.assign(data.approveUrl);
    } catch {
      fail("Could not reach the payment service. No money was moved.");
    }
  }, [selected, paymentStatus, spendingLimit, products, recommendedId, log]);

  const cancel = useCallback(() => {
    if (!selected || paymentStatus !== "awaiting_approval") return;
    // No PayPal order exists yet, so there is nothing to persist: timeline only.
    setPaymentStatus("cancelled");
    setPaymentMessage("You cancelled this purchase before checkout. Nothing was charged.");
    log("Purchase cancelled before checkout", "warning", selected.name);
  }, [selected, paymentStatus, log]);

  const retry = useCallback(() => {
    setPaymentStatus(selected ? "awaiting_approval" : "not_started");
    setPaymentMessage(null);
  }, [selected]);

  return {
    spendingLimit, setSpendingLimit, spent, remaining,
    messages, events, products, recommendedId, selected, selectedId,
    transactions, paymentStatus, paymentMessage, isSearching,
    sendMessage, selectProduct, approve, cancel, retry,
  };
}
