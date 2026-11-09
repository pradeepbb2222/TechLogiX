
import type { ShoppingIntent } from "./gemini";

export function understandShoppingRequestFallback(
  message: string,
): ShoppingIntent {
  const text = message.toLowerCase().trim();

  // Recognize only categories supported by our current search logic.
  let category: string | null = null;

  if (/\b(headphones?|headsets?|earphones?|earbuds?)\b/.test(text)) {
    category = "headphones";
  } else if (
    /\b(smartphones?|mobile phones?|cell phones?)\b/.test(text)
  ) {
    category = "smartphones";
  } else if (/\b(laptops?|notebooks?)\b/.test(text)) {
    category = "laptops";
  } else if (/\b(computers?|desktops?)\b/.test(text)) {
    category = "computers";
  }

  // Extract an explicitly stated budget.
  const budgetMatch =
    text.match(
      /(?:under|below|less than|at most|maximum|max(?:imum)?(?: budget)?(?: of)?)\s*\$?\s*([\d,]+(?:\.\d+)?)/,
    ) ??
    text.match(/\$\s*([\d,]+(?:\.\d+)?)/);

  const budget = budgetMatch
    ? Number(budgetMatch[1].replace(/,/g, ""))
    : null;

  const hardRequirements: ShoppingIntent["hardRequirements"] = [];

  // Explicit Bluetooth requirement.
  if (/\bbluetooth\b/.test(text)) {
    hardRequirements.push({
      attribute: "bluetooth",
      operator: "contains",
      value: "Bluetooth",
      unit: null,
      mandatory: true,
    });
  }

  // Explicit noise cancellation requirement.
  if (/noise[\s-]*cancell(?:ation|ing)/.test(text)) {
    hardRequirements.push({
      attribute: "noise cancellation",
      operator: "contains",
      value: "noise cancellation",
      unit: null,
      mandatory: true,
    });
  }

  // Extract RAM requirements.
  const ramMatch = text.match(
    /(\d+(?:\.\d+)?)\s*gb\s*(?:of\s*)?ram\b/,
  );

  if (ramMatch) {
    hardRequirements.push({
      attribute: "ram",
      operator: /\b(at least|minimum|min|or more)\b/.test(
        text.slice(Math.max(0, ramMatch.index! - 25), ramMatch.index!),
      )
        ? "min"
        : "equals",
      value: ramMatch[1],
      unit: "gb",
      mandatory: true,
    });
  }

  // Extract storage requirements.
  const storageMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(gb|tb)\s*(?:of\s*)?(?:internal\s*)?(?:storage|ssd)\b/,
  );

  if (storageMatch) {
    hardRequirements.push({
      attribute: "storage",
      operator: /\b(at least|minimum|min|or more)\b/.test(
        text.slice(
          Math.max(0, storageMatch.index! - 25),
          storageMatch.index!,
        ),
      )
        ? "min"
        : "equals",
      value: storageMatch[1],
      unit: storageMatch[2],
      mandatory: true,
    });
  }

  // Keep useful search terms without passing budget wording.
  const ignoredWords = new Set([
    "i", "am", "a", "an", "the", "for", "with", "and",
    "or", "find", "me", "want", "need", "looking", "to",
    "buy", "get", "please", "under", "below", "less",
    "than", "at", "most", "maximum", "budget", "of",
    "dollar", "dollars", "usd",
  ]);

  const categoryWords = new Set([
    "headphone", "headphones", "headset", "headsets",
    "earphone", "earphones", "earbud", "earbuds",
    "smartphone", "smartphones", "mobile", "phone", "phones",
    "laptop", "laptops", "notebook", "notebooks",
    "computer", "computers", "desktop", "desktops",
  ]);

  const keywords = [
    ...new Set(
      text
        .replace(/\$?[\d,]+(?:\.\d+)?/g, " ")
        .split(/[^a-z0-9]+/)
        .filter(
          (word) =>
            word.length > 2 &&
            !ignoredWords.has(word) &&
            !categoryWords.has(word),
        ),
    ),
  ];

  const needsClarification = category === null;

  return {
    category,
    budget,
    keywords,
    preferences: [],
    hardRequirements,
    needsClarification,
    clarificationQuestion: needsClarification
      ? "What type of product are you looking for? Currently I can search headphones, smartphones, laptops and computers."
      : null,
  };
}
