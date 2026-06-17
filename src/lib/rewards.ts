import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rewardRedemptions, rewardBonuses, transactions } from "@/db/schema";

/**
 * Current reward points balance for an account: points earned on transactions
 * plus manual bonuses, minus points spent on redemptions, scoped to the user.
 * A single aggregate query using scalar subqueries (no per-row N+1).
 */
export async function getPointsBalance(userId: string, accountId: string): Promise<number> {
  const result = await db.execute<{ earned: string; bonus: string; redeemed: string }>(sql`
    select
      coalesce((
        select sum(${transactions.rewardPoints})
        from ${transactions}
        where ${transactions.userId} = ${userId} and ${transactions.accountId} = ${accountId}
      ), 0) as earned,
      coalesce((
        select sum(${rewardBonuses.points})
        from ${rewardBonuses}
        where ${rewardBonuses.userId} = ${userId} and ${rewardBonuses.accountId} = ${accountId}
      ), 0) as bonus,
      coalesce((
        select sum(${rewardRedemptions.points})
        from ${rewardRedemptions}
        where ${rewardRedemptions.userId} = ${userId} and ${rewardRedemptions.accountId} = ${accountId}
      ), 0) as redeemed
  `);

  const row = result.rows[0];
  if (!row) return 0;
  return Number(row.earned) + Number(row.bonus) - Number(row.redeemed);
}

/** Throws if the requested points exceed the account's current balance. */
export async function assertSufficientPoints(userId: string, accountId: string, points: number) {
  const balance = await getPointsBalance(userId, accountId);
  if (points > balance) {
    throw new InsufficientPointsError(balance);
  }
}

export class InsufficientPointsError extends Error {
  constructor(balance: number) {
    super(`Insufficient points balance (available: ${balance})`);
    this.name = "InsufficientPointsError";
  }
}
