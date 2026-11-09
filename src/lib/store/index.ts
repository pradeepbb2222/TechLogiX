
import { fileStore } from "./file-store";
import { createSupabaseStore } from "./supabase-store";
import type { TxStore } from "./types";

/**
 * Production must always use Supabase.
 * File storage is permitted only during local development.
 */
export function getStore(): TxStore {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (url && key) {
    return createSupabaseStore(url, key);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Supabase configuration is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return fileStore;
}
