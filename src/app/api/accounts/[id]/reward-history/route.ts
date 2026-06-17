import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions, rewardBonuses, rewardRedemptions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok, fail } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type Kind = "earned" | "bonus" | "redeemed";

type HistoryEntry = {
  id: string;
  kind: Kind;
  points: number; // signed: positive for earned/bonus, negative for redeemed
  description: string | null;
  date: string;
  createdAt: string;
  balance: number; // running balance after this entry
};

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  if (!account) return fail("Account not found", 404);

  const scope = and(eq(transactions.userId, userId), eq(transactions.accountId, id));

  const [earned, bonuses, redemptions] = await Promise.all([
    db
      .select({
        id: transactions.id,
        points: transactions.rewardPoints,
        description: transactions.description,
        date: transactions.date,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(and(scope, isNotNull(transactions.rewardPoints), ne(transactions.rewardPoints, "0"))),
    db
      .select({
        id: rewardBonuses.id,
        points: rewardBonuses.points,
        description: rewardBonuses.description,
        date: rewardBonuses.date,
        createdAt: rewardBonuses.createdAt,
      })
      .from(rewardBonuses)
      .where(and(eq(rewardBonuses.userId, userId), eq(rewardBonuses.accountId, id))),
    db
      .select({
        id: rewardRedemptions.id,
        points: rewardRedemptions.points,
        description: rewardRedemptions.description,
        date: rewardRedemptions.date,
        createdAt: rewardRedemptions.createdAt,
      })
      .from(rewardRedemptions)
      .where(and(eq(rewardRedemptions.userId, userId), eq(rewardRedemptions.accountId, id))),
  ]);

  const merged: Omit<HistoryEntry, "balance">[] = [
    ...earned.map((r) => ({
      id: `earn_${r.id}`,
      kind: "earned" as const,
      points: Number(r.points),
      description: r.description,
      date: r.date,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
    ...bonuses.map((r) => ({
      id: `bonus_${r.id}`,
      kind: "bonus" as const,
      points: Number(r.points),
      description: r.description,
      date: r.date,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
    ...redemptions.map((r) => ({
      id: `redeem_${r.id}`,
      kind: "redeemed" as const,
      points: -Number(r.points),
      description: r.description,
      date: r.date,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
  ];

  // Oldest first to accumulate a running balance, then present newest first.
  merged.sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.createdAt.localeCompare(b.createdAt),
  );

  let running = 0;
  const ascending: HistoryEntry[] = merged.map((e) => {
    running += e.points;
    return { ...e, balance: running };
  });

  return ok({ pointsBalance: running, history: ascending.reverse() });
});
