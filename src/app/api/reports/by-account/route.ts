import { and, eq, gte, lte, sql, desc, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { transactions, accounts } from "@/db/schema";
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
      accountId: transactions.accountId,
      name: sql<string>`coalesce(${accounts.name}, 'Unknown')`,
      total: sql<string>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...filters))
    .groupBy(transactions.accountId, accounts.name)
    .orderBy(desc(sql`sum(${transactions.amount})`));

  return ok(rows.map((r) => ({ ...r, total: Number(r.total) })));
});
