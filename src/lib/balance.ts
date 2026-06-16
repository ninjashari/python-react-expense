import { sql, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";

/** Signed effect of a transaction on its primary account. */
export function primaryDelta(type: string, amount: number): number {
  if (type === "income") return amount;
  return -amount; // expense and transfer both reduce the source account
}

/** Signed effect on the destination account (transfers only). */
export function secondaryDelta(type: string, amount: number): number {
  return type === "transfer" ? amount : 0;
}

/**
 * Recomputes the cached balance for a single account from its opening
 * balance plus the signed sum of all related transactions.
 */
export async function recalcAccountBalance(userId: string, accountId: string) {
  const [row] = await db
    .select({
      opening: accounts.openingBalance,
      incoming: sql<string>`coalesce(sum(case
        when ${transactions.type} = 'income' and ${transactions.accountId} = ${accountId} then ${transactions.amount}
        when ${transactions.type} = 'transfer' and ${transactions.toAccountId} = ${accountId} then ${transactions.amount}
        else 0 end), 0)`,
      outgoing: sql<string>`coalesce(sum(case
        when ${transactions.type} in ('expense','transfer') and ${transactions.accountId} = ${accountId} then ${transactions.amount}
        else 0 end), 0)`,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.userId, userId),
        sql`(${transactions.accountId} = ${accountId} or ${transactions.toAccountId} = ${accountId})`,
      ),
    )
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .groupBy(accounts.openingBalance);

  if (!row) return null;
  const balance = Number(row.opening) + Number(row.incoming) - Number(row.outgoing);
  await db
    .update(accounts)
    .set({ balance: balance.toFixed(2), updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  return balance;
}

/** Recomputes balances for every account owned by the user. */
export async function recalcAllBalances(userId: string) {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  for (const r of rows) {
    await recalcAccountBalance(userId, r.id);
  }
  return rows.length;
}
