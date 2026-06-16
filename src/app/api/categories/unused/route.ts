import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok } from "@/lib/http";

export const runtime = "nodejs";

export const DELETE = route(async () => {
  const userId = await requireUserId();

  const used = await db
    .selectDistinct({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(and(eq(transactions.userId, userId)));
  const usedIds = used.map((r) => r.categoryId).filter((id): id is string => !!id);

  const where =
    usedIds.length > 0
      ? and(eq(categories.userId, userId), notInArray(categories.id, usedIds))
      : eq(categories.userId, userId);

  const deleted = await db.delete(categories).where(where).returning({ id: categories.id });
  return ok({ deleted: deleted.length });
});
