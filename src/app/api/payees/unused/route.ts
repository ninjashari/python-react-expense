import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { payees, transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok } from "@/lib/http";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const DELETE = route(async () => {
  const userId = await requireUserId();

  const used = await db
    .selectDistinct({ payeeId: transactions.payeeId })
    .from(transactions)
    .where(and(eq(transactions.userId, userId)));
  const usedIds = used.map((r) => r.payeeId).filter((id): id is string => !!id);

  const where =
    usedIds.length > 0
      ? and(eq(payees.userId, userId), notInArray(payees.id, usedIds))
      : eq(payees.userId, userId);

  const deleted = await db.delete(payees).where(where).returning({ id: payees.id });
  logger.info("unused payees removed", { userId, deleted: deleted.length });
  return ok({ deleted: deleted.length });
});
