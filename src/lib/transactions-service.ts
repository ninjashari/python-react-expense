import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { recalcAccountBalance } from "@/lib/balance";

/** Throws if any of the given account ids are not owned by the user. */
export async function assertAccountsOwned(userId: string, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return;
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), inArray(accounts.id, unique)));
  if (rows.length !== unique.length) {
    throw new OwnershipError();
  }
}

export async function recalcAffected(userId: string, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  for (const id of unique) await recalcAccountBalance(userId, id);
}

export class OwnershipError extends Error {
  constructor() {
    super("Referenced account does not exist");
    this.name = "OwnershipError";
  }
}
