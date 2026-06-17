import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { transactions, categories } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok } from "@/lib/http";

export const runtime = "nodejs";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const q = new URL(req.url).searchParams;
  const type = q.get("type") === "income" ? "income" : "expense";
  const months = Math.min(36, Math.max(1, Number(q.get("months") ?? 12) || 12));

  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  const sinceStr = since.toISOString().slice(0, 10);

  const filters: SQL[] = [
    eq(transactions.userId, userId),
    eq(transactions.type, type),
    gte(transactions.date, sinceStr),
  ];

  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      categoryId: transactions.categoryId,
      name: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
      color: sql<string>`coalesce(${categories.color}, '#94a3b8')`,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...filters))
    .groupBy(
      sql`to_char(${transactions.date}, 'YYYY-MM')`,
      transactions.categoryId,
      categories.name,
      categories.color,
    );

  return ok(rows.map((r) => ({ ...r, total: Number(r.total) })));
});
