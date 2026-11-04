
import { searchChannel3Products } from "./channel3";
import { rankProducts } from "./gemini";
import type { Product, SearchResponse } from "./types";
import type { ShoppingIntent } from "./gemini";

export async function searchProducts(
  intent: ShoppingIntent,
): Promise<SearchResponse> {
  const parsedBudget = intent.budget;

  const query = [
    intent.category,
    ...intent.keywords,
    ...intent.preferences,
  ]
    .filter((term): term is string => Boolean(term?.trim()))
    .join(" ")
    .trim();

  if (intent.needsClarification || !query) {
    return {
      reply:
        intent.clarificationQuestion ??
        "Tell me what product you're looking for.",
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }

  const products = await searchChannel3Products(query, 30);

  if (products.length === 0) {
    return {
      reply:
        `I couldn't find available products matching "${query}". ` +
        "Try changing your search terms.",
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }

  // Enforce the user's budget using backend logic.
  const affordable =
    parsedBudget === null
      ? products
      : products.filter((product) => product.price <= parsedBudget);

  // Exclude products explicitly described as wired-only.
  const eligible = affordable.filter((product) => {
    const text = [
      product.name,
      product.description ?? "",
      ...product.highlights,
      ...Object.entries(product.structuredAttributes ?? {}).flatMap(
        ([key, values]) => [key, ...values],
      ),
    ]
      .join(" ")
      .toLowerCase();

    const explicitlyWiredOnly =
      /\bwired only\b|\bwired connectivity\b|\bwired connection\b|\bcorded only\b/.test(
        text,
      ) &&
      !/\bwireless\b|\bbluetooth\b|\b2\.4\s*ghz\b|\b2\.4ghz\b/.test(text);

    return !explicitlyWiredOnly;
  });

  if (eligible.length === 0) {
    return {
      reply:
        parsedBudget !== null
          ? `I found ${products.length} matching product(s), but none meet your $${parsedBudget.toFixed(2)} budget or compatibility requirements.`
          : "I couldn't find products that meet your compatibility requirements.",
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }

  // Gemini compares and ranks the actual Channel3 products.
  const ranking = await rankProducts(intent, eligible);

  const rankingById = new Map(
    ranking.rankings.map((item) => [item.productId, item]),
  );

  // Only use rankings belonging to products retrieved from Channel3.
  const ranked = eligible
    .flatMap((product) => {
      const result = rankingById.get(product.id);

      if (!result) return [];

      return [
        {
          ...product,
          score: Math.round(result.score),
          aiReason: result.reason,
          requirements: result.requirements,
        },
      ];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (ranked.length === 0) {
    throw new Error("Gemini could not rank the retrieved products.");
  }

  const top = ranked[0];

  return {
    reply:
      `I found ${ranked.length} real product option(s)` +
      (parsedBudget !== null
        ? ` within your $${parsedBudget.toFixed(2)} budget`
        : "") +
      `. My top pick is ${top.name} from ${top.merchant} ` +
      `at $${top.price.toFixed(2)}. ` +
      "Review the product and approve before payment.",
    products: ranked as Product[],
    recommendedId: top.id,
    parsedBudget,
  };
}
