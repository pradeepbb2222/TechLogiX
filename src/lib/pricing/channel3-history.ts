import { Channel3 } from "@channel3/sdk";

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

export async function getChannel3PriceHistory(
  canonicalProductId: string,
) {
  if (!canonicalProductId.trim()) {
    throw new Error("A valid Channel3 product ID is required.");
  }

  const client = getClient();

  return client.priceTracking.retrieveHistory({
    canonical_product_id: canonicalProductId,
    days: 90,
  });
}
