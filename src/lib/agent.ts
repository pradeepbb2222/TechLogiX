import { SAMPLE_CATALOG } from "./catalog";
import type { Product, SearchResponse } from "./types";

/** Extracts a USD budget such as "under $100", "below 150 dollars", "max 80". */
export function parseBudget(text: string): number | null {
  const patterns = [
    /(?:under|below|less than|max(?:imum)?|up to|within|budget(?: of)?)\s*\$?\s*(\d+(?:\.\d+)?)/i,
    /\$\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(?:dollars|usd)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return Number(m[1]);
  }
  return null;
}

const STOP_WORDS = new Set([
  "find", "me", "a", "an", "the", "for", "under", "below", "with", "and", "to",
  "buy", "get", "best", "good", "cheap", "need", "want", "i", "of", "usd", "dollars",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

function matches(product: Product, tokens: string[]): boolean {
  const haystack = `${product.name} ${product.category} ${product.merchant} ${product.highlights.join(" ")}`.toLowerCase();
  return tokens.some((t) => haystack.includes(t.replace(/s$/, "")));
}

/** Higher is better: rewards rating, review volume and fast delivery, penalises price. */
function scoreProduct(p: Product, budget: number | null): number {
  const rating = (p.rating / 5) * 50;
  const popularity = Math.min(Math.log10(p.reviews + 1) / 4, 1) * 15;
  const delivery = Math.max(0, (7 - p.deliveryDays) / 7) * 15;
  const priceRef = budget ?? 300;
  const value = Math.max(0, 1 - p.price / priceRef) * 20;
  return Math.round(rating + popularity + delivery + value);
}

export function searchProducts(query: string, limitOverride?: number): SearchResponse {
  const parsedBudget = parseBudget(query);
  const budget = parsedBudget ?? limitOverride ?? null;
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return {
      reply: "Tell me what you'd like to buy, e.g. \"wireless headphones under $100\".",
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }

  const matched = SAMPLE_CATALOG.filter((p) => matches(p, tokens));
  const affordable = budget === null ? matched : matched.filter((p) => p.price <= budget);

  if (matched.length === 0) {
    return {
      reply: `I couldn't find sample products matching "${query}". Try headphones, laptop, shoes, watch or keyboard.`,
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }
  if (affordable.length === 0) {
    return {
      reply: `I found ${matched.length} matching item(s), but none are within $${budget?.toFixed(2)}. Try raising your budget.`,
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }

  const ranked = affordable
    .map((p) => ({ ...p, score: scoreProduct(p, budget) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 4);
  const top = ranked[0];

  return {
    reply: `I compared ${ranked.length} option(s)${budget !== null ? ` within $${budget.toFixed(2)}` : ""}. My pick is ${top.name} from ${top.merchant} at $${top.price.toFixed(2)}. Review it and approve to pay — I will never pay without your approval.`,
    products: ranked,
    recommendedId: top.id,
    parsedBudget,
  };
}
