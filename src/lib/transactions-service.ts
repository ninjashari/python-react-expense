import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, payees } from "@/db/schema";
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

/** Throws if the given category id is set but not owned by the user. */
export async function assertCategoryOwned(userId: string, id: string | null | undefined) {
  if (!id) return;
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!row) throw new OwnershipError();
}

/** Throws if the given payee id is set but not owned by the user. */
export async function assertPayeeOwned(userId: string, id: string | null | undefined) {
  if (!id) return;
  const [row] = await db
    .select({ id: payees.id })
    .from(payees)
    .where(and(eq(payees.id, id), eq(payees.userId, userId)))
    .limit(1);
  if (!row) throw new OwnershipError();
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
