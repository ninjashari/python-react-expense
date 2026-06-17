import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { accounts, rewardBonuses } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { redemptionSchema } from "@/lib/validations";
import { route, ok, created, fail } from "@/lib/http";
import { getPointsBalance } from "@/lib/rewards";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function getOwnedAccount(userId: string, accountId: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  return account ?? null;
}

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;

  const account = await getOwnedAccount(userId, id);
  if (!account) return fail("Account not found", 404);

  const [pointsBalance, bonuses] = await Promise.all([
    getPointsBalance(userId, id),
    db
      .select()
      .from(rewardBonuses)
      .where(and(eq(rewardBonuses.userId, userId), eq(rewardBonuses.accountId, id)))
      .orderBy(desc(rewardBonuses.date), desc(rewardBonuses.createdAt)),
  ]);

  return ok({ pointsBalance, bonuses });
});

export const POST = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  // Bonuses share the redemption shape (points, description, date) but add points.
  const data = redemptionSchema.parse(await req.json());

  const account = await getOwnedAccount(userId, id);
  if (!account) return fail("Account not found", 404);
  if (account.type !== "credit") {
    return fail("Only credit accounts earn reward points", 422);
  }

  const [row] = await db
    .insert(rewardBonuses)
    .values({
      userId,
      accountId: id,
      points: data.points.toFixed(2),
      description: data.description ?? null,
      date: data.date,
    })
    .returning();

  logger.info("reward bonus added", { userId, accountId: id, points: data.points });
  return created(row);
});
