import { fileStore } from "./file-store";
import { createSupabaseStore } from "./supabase-store";
import type { TxStore } from "./types";

/** Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, otherwise a local file store. */
export function getStore(): TxStore {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? createSupabaseStore(url, key) : fileStore;
}
