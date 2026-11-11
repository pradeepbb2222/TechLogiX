
import { promises as fs } from "node:fs";
import path from "node:path";
import { applyExpiry, applyTransition, filterByUser } from "../checkout/logic";
import type { PaymentStatus } from "../types";
import type { NewTxRecord, TxPatch, TxRecord, TxStore } from "./types";
import { DuplicateOrderError } from "./types";

/** Local-development fallback. Data lives in ./.data (git-ignored). */

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
    const records = JSON.parse(await fs.readFile(FILE, "utf8")) as TxRecord[];

    // Old file-store records may predate authenticated ownership.
    return records.map((record) => ({
      ...record,
      userId: record.userId ?? null,
    }));
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

  create: (record: NewTxRecord) =>
    withLock(async () => {
      const all = await readAll();

      if (all.some((r) => r.orderId === record.orderId)) {
        throw new DuplicateOrderError(record.orderId);
      }

      await writeAll([record, ...all]);
    }),

  get: (orderId: string, userId: string) =>
    withLock(async () => {
      const records = await readAll();

      return (
        records.find(
          (record) =>
            record.orderId === orderId &&
            record.userId === userId,
        ) ?? null
      );
    }),

  getByOrderId: (orderId: string) =>
    withLock(async () => {
      const records = await readAll();

      return records.find((record) => record.orderId === orderId) ?? null;
    }),

  listByUser: (userId: string) =>
    withLock(async () => filterByUser(await readAll(), userId)),

  transition: (
    orderId: string,
    userId: string,
    from: PaymentStatus[],
    patch: TxPatch,
  ) =>
    withLock(async () => {
      const result = applyTransition(
        await readAll(),
        orderId,
        userId,
        from,
        patch,
        new Date().toISOString(),
      );

      if (!result.updated) return null;

      await writeAll(result.records);
      return result.updated;
    }),

  expireStale: (beforeIso: string, note: string) =>
    withLock(async () => {
      const result = applyExpiry(
        await readAll(),
        beforeIso,
        note,
        new Date().toISOString(),
      );

      if (result.count > 0) {
        await writeAll(result.records);
      }

      return result.count;
    }),
};
