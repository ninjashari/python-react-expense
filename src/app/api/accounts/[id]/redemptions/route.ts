import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { accounts, rewardRedemptions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { redemptionSchema } from "@/lib/validations";
import { route, ok, created, fail } from "@/lib/http";
import { getPointsBalance, assertSufficientPoints } from "@/lib/rewards";

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

  const [pointsBalance, redemptions] = await Promise.all([
    getPointsBalance(userId, id),
    db
      .select()
      .from(rewardRedemptions)
      .where(and(eq(rewardRedemptions.userId, userId), eq(rewardRedemptions.accountId, id)))
      .orderBy(desc(rewardRedemptions.date), desc(rewardRedemptions.createdAt)),
  ]);

  return ok({ pointsBalance, redemptions });
});

export const POST = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const data = redemptionSchema.parse(await req.json());

  const account = await getOwnedAccount(userId, id);
  if (!account) return fail("Account not found", 404);
  if (account.type !== "credit") {
    return fail("Only credit accounts earn reward points", 422);
  }

  await assertSufficientPoints(userId, id, data.points);

  const [row] = await db
    .insert(rewardRedemptions)
    .values({
      userId,
      accountId: id,
      points: data.points.toFixed(2),
      description: data.description ?? null,
      date: data.date,
    })
    .returning();

  return created(row);
});
