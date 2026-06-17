import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { bulkTransactionSchema } from "@/lib/validations";
import { route, ok, fail } from "@/lib/http";
import {
  assertCategoryOwned,
  assertPayeeOwned,
  recalcAffected,
} from "@/lib/transactions-service";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const data = bulkTransactionSchema.parse(await req.json());

  // Fetch the targeted rows scoped to the user — this both enforces ownership
  // (no IDOR) and gives us the accounts to recalc afterwards.
  const owned = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      toAccountId: transactions.toAccountId,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, data.ids)));

  if (owned.length === 0) return fail("No matching transactions", 404);

  const ids = owned.map((r) => r.id);
  const affectedAccounts = owned.flatMap((r) => [r.accountId, r.toAccountId]);
  const scope = and(eq(transactions.userId, userId), inArray(transactions.id, ids));

  if (data.action === "delete") {
    await db.delete(transactions).where(scope);
    await recalcAffected(userId, affectedAccounts);
    return ok({ affected: ids.length });
  }

  if (data.action === "categorize") {
    await assertCategoryOwned(userId, data.categoryId);
    await db
      .update(transactions)
      .set({ categoryId: data.categoryId, updatedAt: new Date() })
      .where(scope);
    return ok({ affected: ids.length });
  }

  // setPayee
  await assertPayeeOwned(userId, data.payeeId);
  await db
    .update(transactions)
    .set({ payeeId: data.payeeId, updatedAt: new Date() })
    .where(scope);
  return ok({ affected: ids.length });
});
