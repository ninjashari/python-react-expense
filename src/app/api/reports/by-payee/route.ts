import { and, eq, gte, lte, sql, desc, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { transactions, payees } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok } from "@/lib/http";

export const runtime = "nodejs";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const q = new URL(req.url).searchParams;
  const type = q.get("type") === "income" ? "income" : "expense";

  const filters: SQL[] = [eq(transactions.userId, userId), eq(transactions.type, type)];
  const from = q.get("from");
  if (from) filters.push(gte(transactions.date, from));
  const to = q.get("to");
  if (to) filters.push(lte(transactions.date, to));

  const rows = await db
    .select({
      payeeId: transactions.payeeId,
      name: sql<string>`coalesce(${payees.name}, 'No payee')`,
      color: sql<string>`coalesce(${payees.color}, '#94a3b8')`,
      total: sql<string>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(payees, eq(transactions.payeeId, payees.id))
    .where(and(...filters))
    .groupBy(transactions.payeeId, payees.name, payees.color)
    .orderBy(desc(sql`sum(${transactions.amount})`))
    .limit(20);

  return ok(rows.map((r) => ({ ...r, total: Number(r.total) })));
});
