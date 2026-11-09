
import { Channel3 } from "@channel3/sdk";
import type { Product } from "./types";

function getClient() {
  const apiKey = process.env.CHANNEL3_API_KEY;

  if (!apiKey) {
    throw new Error("CHANNEL3_API_KEY is not configured.");
  }

  return new Channel3({
  apiKey,
  timeoutInSeconds: 30,
  maxRetries: 2,
});
}

export async function searchChannel3Products(
  query: string,
  limit = 20,
  categorySlug?: string,
): Promise<Product[]> {
  const client = getClient();

  const response = await client.products.search({
  query,
  limit: Math.min(Math.max(limit, 1), 30),
  ...(categorySlug
    ? { filters: { category_ids: [categorySlug] } }
    : {}),
  config: {
    country: "US",
    currency: "USD",
    language: "en",
  },
});
  
  return response.data
    .map((item): Product | null => {
      const offers = (item.offers ?? [])
        .filter(
          (offer) =>
            offer.availability === "InStock" &&
            offer.price.currency.toUpperCase() === "USD" &&
            Number.isFinite(offer.price.price) &&
            offer.price.price > 0 &&
            Boolean(offer.url),
        )
        .sort((a, b) => a.price.price - b.price.price);

      const bestOffer = offers[0];

      if (!bestOffer) {
        return null;
      }

      const mainImage =
        item.images?.find((image) => image.is_main_image) ??
        item.images?.[0];

      return {
        id: item.id,
        name: item.title,
        merchant: bestOffer.domain,
        category: item.category?.title ?? "Other",
        price: bestOffer.price.price,
        currency: "USD",
        rating: item.ratings?.value,
        reviews: item.ratings?.count,
        imageUrl: mainImage?.cleaned_url || mainImage?.url || undefined,
        productUrl: bestOffer.url,
        highlights: item.key_features ?? [],
        description: item.description ?? undefined,
        materials: item.materials ?? undefined,
        structuredAttributes: item.structured_attributes ?? undefined,
      };
    })
    .filter((product): product is Product => product !== null);
}

export async function getChannel3Product(
  productId: string,
): Promise<Product | null> {
  const client = getClient();

  const item = await client.products.retrieve({
    product_id: productId,
    country: "US",
    currency: "USD",
    language: "en",
  });

  const offers = (item.offers ?? [])
    .filter(
      (offer) =>
        offer.availability === "InStock" &&
        offer.price.currency.toUpperCase() === "USD" &&
        Number.isFinite(offer.price.price) &&
        offer.price.price > 0 &&
        Boolean(offer.url),
    )
    .sort((a, b) => a.price.price - b.price.price);

  const bestOffer = offers[0];

  if (!bestOffer) {
    return null;
  }

  const mainImage =
    item.images?.find((image) => image.is_main_image) ??
    item.images?.[0];

  return {
    id: item.id,
    name: item.title,
    merchant: bestOffer.domain,
    category: item.category?.title ?? "Other",
    price: bestOffer.price.price,
    currency: "USD",
    rating: item.ratings?.value,
    reviews: item.ratings?.count,
    imageUrl: mainImage?.cleaned_url || mainImage?.url || undefined,
    productUrl: bestOffer.url,
    highlights: item.key_features ?? [],
    description: item.description ?? undefined,
    materials: item.materials ?? undefined,
    structuredAttributes: item.structured_attributes ?? undefined,
  };
}

export async function inspectChannel3Categories() {
  const client = getClient();

  const firstPage = await client.categories.list({
    page: 1,
    page_size: 100,
  });

  const total = firstPage.response.total;
  const totalPages = Math.ceil(total / 100);

  const keywords = [
    "headphone",
    "earphone",
    "audio",
    "smartphone",
    "mobile",
    "cell phone",
    "laptop",
    "computer",
  ];

  console.log("TOTAL CHANNEL3 CATEGORIES:", total);

  for (let page = 1; page <= totalPages; page++) {
    const result =
      page === 1
        ? firstPage
        : await client.categories.list({
            page,
            page_size: 100,
          });

    const matches = result.data.filter((category) => {
      const text =
        `${category.title} ${category.slug}`.toLowerCase();

      return keywords.some((keyword) =>
        text.includes(keyword),
      );
    });

    if (matches.length > 0) {
      console.log(
        `MATCHING CATEGORIES — PAGE ${page}:`,
        matches.map((category) => ({
          title: category.title,
          slug: category.slug,
        })),
      );
    }
  }

  console.log("CATEGORY INSPECTION COMPLETED");
}