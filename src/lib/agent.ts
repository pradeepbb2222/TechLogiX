import { searchChannel3Products } from "./channel3";
import { rankProducts } from "./gemini";
import type { Product, SearchResponse } from "./types";
import type { ShoppingIntent } from "./gemini";

type Requirement = ShoppingIntent["hardRequirements"][number];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveCategorySlug(category: string | null): string | undefined {
  if (!category) return undefined;

  const normalized = category.toLowerCase().trim();

  if (/\b(headphones?|headsets?)\b/.test(normalized)) {
    return "headphones";
  }

  if (
    /\b(smartphones?|mobile phones?|cell phones?)\b/.test(normalized)
  ) {
    return "mobile-phones";
  }

  if (/\blaptops?\b/.test(normalized)) {
    return "laptops";
  }

  if (/\bcomputers?\b/.test(normalized)) {
    return "computers";
  }

  return undefined;
}

function getAttributeAliases(attribute: string): string[] {
  const aliases: Record<string, string[]> = {
    ram: ["ram", "memory", "system memory"],
    storage: ["storage", "internal storage", "capacity"],
    battery: ["battery", "battery capacity"],
    processor: ["processor", "cpu", "chipset"],
    display: ["display", "screen", "screen size"],
    resolution: ["resolution", "display resolution"],
    bluetooth: [
  "bluetooth",
  "bluetooth version",
  "connectivity-technology",
  "audio-connectivity",
],
    weight: ["weight", "item weight"],
    color: ["color", "colour"],

    // Channel3 headphone attributes
    "noise cancellation": [
      "noise-cancellation-technology",
      "earphone-features",
    ],
    connectivity: ["connectivity-technology", "audio-connectivity"],
    microphone: ["microphone-type", "earphone-features"],
    "water resistance": ["ingress-protection-ip-rating"],
    "ip rating": ["ingress-protection-ip-rating"],
    "headphone style": ["headphone-style"],
    "charging port": ["charging-interface-type"],
    material: ["material"],
  };

  const normalized = normalize(attribute);

  const matchingAlias = Object.entries(aliases).find(
  ([key]) => normalize(key) === normalized,
);

return matchingAlias?.[1] ?? [attribute];
}

function getAttributeValues(
  product: Product,
  attribute: string,
): string[] {
  const attributes = product.structuredAttributes ?? {};
  const acceptedNames = getAttributeAliases(attribute).map(normalize);

  return Object.entries(attributes)
    .filter(([key]) => acceptedNames.includes(normalize(key)))
    .flatMap(([, values]) => values);
}

function validateRequirement(
  product: Product,
  requirement: Requirement,
): "verified" | "unknown" | "mismatch" {
  const values = getAttributeValues(product, requirement.attribute);

  if (values.length === 0) {
    return "unknown";
  }

  const expected = requirement.value.trim().toLowerCase();

  // Handle text-based requirements.
  if (requirement.operator === "contains") {
    return values.some((value) =>
      normalize(value).includes(normalize(expected)),
    )
      ? "verified"
      : "mismatch";
  }

  // Handle categorical equality.
  const expectedNumber = Number(requirement.value);

  const isNumericRequirement =
    Number.isFinite(expectedNumber) &&
    (requirement.operator === "min" ||
      requirement.operator === "max" ||
      requirement.operator === "equals");

  if (requirement.operator === "equals" && !isNumericRequirement) {
    return values.some(
      (value) => normalize(value) === normalize(expected),
    )
      ? "verified"
      : "mismatch";
  }

  if (!isNumericRequirement) {
    return "unknown";
  }

  const unit = requirement.unit
    ? normalize(requirement.unit)
    : null;

  const numericValues = values
    .map((value) => {
      const match = value
        .replace(/,/g, "")
        .match(/(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);

      if (!match) return null;

      return {
        number: Number(match[1]),
        unit: match[2] ? normalize(match[2]) : null,
      };
    })
    .filter(
      (value): value is { number: number; unit: string | null } =>
        value !== null,
    );

  if (numericValues.length === 0) {
    return "unknown";
  }

  const comparableValues = numericValues.filter(
    (value) => value.unit === unit,
  );

  if (comparableValues.length === 0) {
    return "unknown";
  }

  if (requirement.operator === "equals") {
    return comparableValues.some(
      (value) => value.number === expectedNumber,
    )
      ? "verified"
      : "mismatch";
  }

  if (requirement.operator === "min") {
    return comparableValues.some(
      (value) => value.number >= expectedNumber,
    )
      ? "verified"
      : "mismatch";
  }

  if (requirement.operator === "max") {
    return comparableValues.some(
      (value) => value.number <= expectedNumber,
    )
      ? "verified"
      : "mismatch";
  }

  return "unknown";
}

function validateCategory(
  product: Product,
  intent: ShoppingIntent,
): boolean {
  if (!intent.category) return true;

  const category = normalize(intent.category);

  const productName = normalize(product.name);
  const productCategory = normalize(product.category);
  const productText = normalize(
    [
      product.name,
      product.category,
      product.description ?? "",
    ].join(" "),
  );

  const matchesAny = (text: string, terms: string[]) =>
    terms.some((term) => text.includes(normalize(term)));

  // Smartphone category and its common synonyms.
  if (
    matchesAny(category, [
      "smartphone",
      "smartphones",
      "mobile phone",
      "mobile phones",
      "cell phone",
      "cell phones",
    ])
  ) {
    return (
      matchesAny(productText, [
        "smartphone",
        "mobile phone",
        "cell phone",
      ]) &&
      !matchesAny(productName + productCategory, [
        "power bank",
        "replacement battery",
        "battery pack",
      ])
    );
  }

  // Headphones, headsets, earphones and earbuds.
  if (
    matchesAny(category, [
      "headphone",
      "headphones",
      "headset",
      "headsets",
      "earphone",
      "earphones",
      "earbud",
      "earbuds",
    ])
  ) {
    return (
      matchesAny(productText, [
        "headphone",
        "headset",
        "earphone",
        "earbud",
      ]) &&
      !matchesAny(productName + productCategory, [
        "headphone stand",
        "headphone case",
        "earphone case",
        "replacement ear pads",
        "replacement ear tips",
      ])
    );
  }

  // Laptops and notebooks.
  if (
    matchesAny(category, ["laptop", "laptops", "notebook", "notebooks"])
  ) {
    return matchesAny(productText, ["laptop", "notebook"]);
  }

  // General computers, including desktops and laptops.
  if (
    matchesAny(category, ["computer", "computers", "desktop computer"])
  ) {
    return matchesAny(productText, [
      "computer",
      "desktop",
      "laptop",
      "notebook",
    ]);
  }

  // Fallback for categories without a defined synonym family.
  return productText.includes(category);
}

function validateProduct(product: Product, intent: ShoppingIntent) {
  const requirements = intent.hardRequirements
    .filter((requirement) => requirement.mandatory)
    .map((requirement) => ({
      requirement:
        `${requirement.attribute} ${requirement.operator} ${requirement.value}` +
        (requirement.unit ? ` ${requirement.unit}` : ""),
      status: validateRequirement(product, requirement),
      evidence: getAttributeValues(product, requirement.attribute).join(", ") ||
        "No matching structured attribute was provided by Channel3.",
    }));

  const isEligible = requirements.every(
    (requirement) => requirement.status === "verified",
  );

  return {
    ...product,
    requirements,
    isEligible,
  };
}

export async function searchProducts(
  intent: ShoppingIntent,
): Promise<SearchResponse> {
  const parsedBudget = intent.budget;

  // Search using category and product keywords only.
  const query = [
    intent.category,
    ...intent.keywords,
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

  const categorySlug = resolveCategorySlug(intent.category);

  // Retrieve real products from Channel3.
  const products = await searchChannel3Products(
    query,
    30,
    categorySlug,
  );

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

  // Reject products outside the requested category.
  const categoryProducts = products.filter((product) =>
    validateCategory(product, intent),
  );

  if (categoryProducts.length === 0) {
    return {
      reply:
        "I found products, but none matched your requested product category. " +
        "Try using different search terms.",
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }

  // Enforce the user's budget on the server.
  const affordable =
    parsedBudget === null
      ? categoryProducts
      : categoryProducts.filter(
          (product) => product.price <= parsedBudget,
        );

  if (affordable.length === 0) {
    return {
      reply:
        `I found ${categoryProducts.length} product(s) in your requested category, ` +
        `but none were within your $${parsedBudget!.toFixed(2)} budget. ` +
        "Try increasing your budget.",
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }

  // Independently verify mandatory specifications using Channel3 data.
  const validated = affordable.map((product) =>
    validateProduct(product, intent),
  );

  const eligible = validated.filter(
    (product) => product.isEligible,
  );

  if (eligible.length === 0) {
    const productsWithMismatch = validated.filter((product) =>
      (product.requirements ?? []).some(
        (requirement) => requirement.status === "mismatch",
      ),
    ).length;

    const productsWithUnknown = validated.filter(
      (product) =>
        !(product.requirements ?? []).some(
          (requirement) => requirement.status === "mismatch",
        ) &&
        (product.requirements ?? []).some(
          (requirement) => requirement.status === "unknown",
        ),
    ).length;

    let explanation =
      "I couldn't find any products that passed all your mandatory requirements.";

    if (productsWithMismatch > 0 || productsWithUnknown > 0) {
      explanation += " Here's why:";

      if (productsWithMismatch > 0) {
        explanation +=
          ` ${productsWithMismatch} product(s) had confirmed specification mismatches.`;
      }

      if (productsWithUnknown > 0) {
        explanation +=
          ` ${productsWithUnknown} product(s) lacked sufficient specification evidence.`;
      }
    }

    return {
      reply:
        explanation +
        " Try relaxing a requirement or changing your search.",
      products: [],
      recommendedId: null,
      parsedBudget,
    };
  }

  // Gemini ranks only products that passed backend validation.
let ranking;
let usedFallback = false;

try {
  ranking = await rankProducts(intent, eligible);
} catch (error) {
  console.error(
    "Gemini ranking unavailable. Using fallback ranking:",
    error,
  );

  usedFallback = true;

  const sortedProducts = [...eligible].sort((a, b) => {
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;

    if (ratingA !== ratingB) {
      return ratingB - ratingA;
    }

    const reviewsA = a.reviews ?? 0;
    const reviewsB = b.reviews ?? 0;

    if (reviewsA !== reviewsB) {
      return reviewsB - reviewsA;
    }

    return a.price - b.price;
  });

  const fallbackRankings = sortedProducts.map((product, index) => ({
    productId: product.id,
    score: Math.max(50, 100 - index * 10),
    reason:
      "Fallback ranking based on actual product ratings, review counts and price. Gemini ranking was unavailable.",
  }));

  ranking = {
    rankings: fallbackRankings,
  };
}

  // Ensure Gemini returned every eligible product exactly once.
  const rankingIds = ranking.rankings.map(
    (item) => item.productId,
  );

  const uniqueRankingIds = new Set(rankingIds);

  if (
    rankingIds.length !== eligible.length ||
    uniqueRankingIds.size !== eligible.length
  ) {
    throw new Error(
      "Gemini returned an incomplete or duplicate product ranking.",
    );
  }

  const rankingById = new Map(
    ranking.rankings.map((item) => [item.productId, item]),
  );

  const ranked = eligible
    .map((product) => {
      const result = rankingById.get(product.id);

      if (!result) {
        throw new Error(
          `Missing Gemini ranking for product ${product.id}.`,
        );
      }

      return {
        ...product,
        score: Math.round(result.score),
        aiReason: usedFallback
  ? `Automatic fallback: ${result.reason}`
  : result.reason,

        // Backend validation remains authoritative.
        requirements: product.requirements,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const top = ranked[0];

  return {
    reply:
      `I found ${ranked.length} product option(s) that passed mandatory requirement checks` +
      (parsedBudget !== null
        ? ` within your $${parsedBudget.toFixed(2)} budget`
        : "") +
      `. My top pick is ${top.name} from ${top.merchant} ` +
      `at $${top.price.toFixed(2)}. ` +
      "Review the product and approve before payment." +
(usedFallback
  ? " Gemini ranking was temporarily unavailable, so fallback ranking was used."
  : ""),
    products: ranked,
    recommendedId: top.id,
    parsedBudget,
  };
}
