import { promises as fs } from "node:fs";
import path from "node:path";
import { applyExpiry, applyTransition, filterByOwner } from "../checkout/logic";
import type { PaymentStatus } from "../types";
import type { TxPatch, TxRecord, TxStore } from "./types";
import { DuplicateOrderError } from "./types";

/** Local-development fallback used when Supabase is not configured. Data lives in ./.data (git-ignored). */

const FILE = path.join(process.cwd(), ".data", "transactions.json");
const globalLock = globalThis as { __agentflowTxLock?: Promise<unknown> };

/** Serialises read-modify-write cycles within this server process. */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = (globalLock.__agentflowTxLock ?? Promise.resolve()).then(fn, fn);
  globalLock.__agentflowTxLock = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<TxRecord[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as TxRecord[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(records: TxRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(records, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

export const fileStore: TxStore = {
  kind: "file",
  create: (record) =>
    withLock(async () => {
      const all = await readAll();
      if (all.some((r) => r.orderId === record.orderId)) throw new DuplicateOrderError(record.orderId);
      await writeAll([record, ...all]);
    }),
  get: (orderId) => withLock(async () => (await readAll()).find((r) => r.orderId === orderId) ?? null),
  list: () => withLock(readAll),
  listByOwner: (ownerHash) => withLock(async () => filterByOwner(await readAll(), ownerHash)),
  transition: (orderId: string, from: PaymentStatus[], patch: TxPatch) =>
    withLock(async () => {
      const result = applyTransition(await readAll(), orderId, from, patch, new Date().toISOString());
      if (!result.updated) return null;
      await writeAll(result.records);
      return result.updated;
    }),
  expireStale: (beforeIso, note) =>
    withLock(async () => {
      const result = applyExpiry(await readAll(), beforeIso, note, new Date().toISOString());
      if (result.count > 0) await writeAll(result.records);
      return result.count;
    }),
};
