import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { payees } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok } from "@/lib/http";
import { randomDistinctColors } from "@/lib/utils";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = route(async () => {
  const userId = await requireUserId();

  const rows = await db
    .select({ id: payees.id })
    .from(payees)
    .where(eq(payees.userId, userId));

  if (rows.length === 0) {
    logger.info("payees recolored", { userId, recolored: 0 });
    return ok({ recolored: 0 });
  }

  const colors = randomDistinctColors(rows.length);
  const ids = rows.map((r) => r.id);
  const cases = sql.join(
    rows.map((r, i) => sql`when ${payees.id} = ${r.id} then ${colors[i]}`),
    sql.raw(" "),
  );

  await db
    .update(payees)
    .set({ color: sql`case ${cases} end`, updatedAt: new Date() })
    .where(and(eq(payees.userId, userId), inArray(payees.id, ids)));

  logger.info("payees recolored", { userId, recolored: rows.length });
  return ok({ recolored: rows.length });
});
