import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { transactionUpdateSchema } from "@/lib/validations";
import { route, ok, noContent, fail } from "@/lib/http";
import {
  assertAccountsOwned,
  assertCategoryOwned,
  assertPayeeOwned,
  recalcAffected,
} from "@/lib/transactions-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function getOwned(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const row = await getOwned(userId, id);
  if (!row) return fail("Transaction not found", 404);
  return ok(row);
});

export const PUT = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const existing = await getOwned(userId, id);
  if (!existing) return fail("Transaction not found", 404);

  const data = transactionUpdateSchema.parse(await req.json());
  const nextType = data.type ?? existing.type;
  const nextAccount = data.accountId ?? existing.accountId;
  const nextTo =
    nextType === "transfer"
      ? (data.toAccountId ?? existing.toAccountId)
      : null;

  if (nextType === "transfer" && !nextTo)
    return fail("Transfers require a destination account", 422);
  if (nextType === "transfer" && nextTo === nextAccount)
    return fail("Cannot transfer to the same account", 422);

  await assertAccountsOwned(userId, [nextAccount, nextTo]);
  if (data.categoryId !== undefined) await assertCategoryOwned(userId, data.categoryId);
  if (data.payeeId !== undefined) await assertPayeeOwned(userId, data.payeeId);

  const update: Record<string, unknown> = { updatedAt: new Date() };
  update.type = nextType;
  update.accountId = nextAccount;
  update.toAccountId = nextTo;
  if (data.categoryId !== undefined) update.categoryId = data.categoryId;
  if (data.payeeId !== undefined) update.payeeId = data.payeeId;
  if (data.amount !== undefined) update.amount = data.amount.toFixed(2);
  if (data.description !== undefined) update.description = data.description;
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.date !== undefined) update.date = data.date;
  if (data.rewardPoints !== undefined)
    update.rewardPoints = data.rewardPoints != null ? data.rewardPoints.toFixed(2) : null;

  const [row] = await db
    .update(transactions)
    .set(update)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();

  await recalcAffected(userId, [
    existing.accountId,
    existing.toAccountId,
    nextAccount,
    nextTo,
  ]);
  return ok(row);
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const existing = await getOwned(userId, id);
  if (!existing) return fail("Transaction not found", 404);

  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  await recalcAffected(userId, [existing.accountId, existing.toAccountId]);
  return noContent();
});
