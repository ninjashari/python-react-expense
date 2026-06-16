import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok } from "@/lib/http";

export const runtime = "nodejs";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const q = new URL(req.url).searchParams;

  const filters: SQL[] = [eq(transactions.userId, userId)];
  const from = q.get("from");
  if (from) filters.push(gte(transactions.date, from));
  const to = q.get("to");
  if (to) filters.push(lte(transactions.date, to));

  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
      expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(and(...filters));

  const income = Number(row?.income ?? 0);
  const expense = Number(row?.expense ?? 0);
  return ok({ income, expense, net: income - expense, count: Number(row?.count ?? 0) });
});
