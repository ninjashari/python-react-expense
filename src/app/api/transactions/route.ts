import {
  and,
  eq,
  gte,
  lte,
  ilike,
  or,
  not,
  isNull,
  inArray,
  desc,
  asc,
  count,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { transactions, accounts, categories, payees } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { transactionSchema, transactionTypeValues } from "@/lib/validations";
import { route, ok, created } from "@/lib/http";
import {
  assertAccountsOwned,
  assertCategoryOwned,
  assertPayeeOwned,
  recalcAffected,
} from "@/lib/transactions-service";

export const runtime = "nodejs";

const fromAcct = accounts;

const NONE = "none";

/**
 * Collect filter ids from both the multi-value param (`accountIds=a,b`) and the
 * legacy singular param (`accountId=a`), so report drill-downs and shared links
 * keep working. Returns the concrete ids plus whether the special "none" token
 * (match rows with no category/payee) was requested.
 */
function collectIds(
  q: URLSearchParams,
  plural: string,
  singular: string,
): { ids: string[]; hasNone: boolean } {
  const raw = [
    ...(q.get(plural)?.split(",") ?? []),
    ...(q.get(singular) ? [q.get(singular)!] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const hasNone = raw.includes(NONE);
  const ids = [...new Set(raw.filter((s) => s !== NONE))];
  return { ids, hasNone };
}

const isTrue = (v: string | null) => v === "1" || v === "true";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const q = url.searchParams;

  const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(q.get("pageSize") ?? 25) || 25));

  const filters: SQL[] = [eq(transactions.userId, userId)];

  // Accounts: match where the account is the source OR the transfer destination.
  const acct = collectIds(q, "accountIds", "accountId");
  if (acct.ids.length > 0) {
    const match = or(
      inArray(transactions.accountId, acct.ids),
      inArray(transactions.toAccountId, acct.ids),
    )!;
    filters.push(isTrue(q.get("excludeAccounts")) ? not(match) : match);
  }

  // Categories: support the "none" token (uncategorised) and include/exclude.
  const cat = collectIds(q, "categoryIds", "categoryId");
  if (cat.ids.length > 0 || cat.hasNone) {
    const parts: SQL[] = [];
    if (cat.ids.length > 0) parts.push(inArray(transactions.categoryId, cat.ids));
    if (cat.hasNone) parts.push(isNull(transactions.categoryId));
    const match = (parts.length === 1 ? parts[0] : or(...parts)!) as SQL;
    filters.push(isTrue(q.get("excludeCategories")) ? not(match) : match);
  }

  // Payees: same treatment as categories.
  const pay = collectIds(q, "payeeIds", "payeeId");
  if (pay.ids.length > 0 || pay.hasNone) {
    const parts: SQL[] = [];
    if (pay.ids.length > 0) parts.push(inArray(transactions.payeeId, pay.ids));
    if (pay.hasNone) parts.push(isNull(transactions.payeeId));
    const match = (parts.length === 1 ? parts[0] : or(...parts)!) as SQL;
    filters.push(isTrue(q.get("excludePayees")) ? not(match) : match);
  }

  const type = q.get("type");
  if (type && (transactionTypeValues as readonly string[]).includes(type))
    filters.push(eq(transactions.type, type as (typeof transactionTypeValues)[number]));
  const from = q.get("from");
  if (from) filters.push(gte(transactions.date, from));
  const to = q.get("to");
  if (to) filters.push(lte(transactions.date, to));
  const search = q.get("search")?.trim();
  if (search) {
    const like = `%${search}%`;
    filters.push(or(ilike(transactions.description, like), ilike(transactions.notes, like))!);
  }

  const where = and(...filters);

  const sortField =
    q.get("sort") === "amount"
      ? transactions.amount
      : q.get("sort") === "created"
        ? transactions.createdAt
        : transactions.date;
  const order = q.get("order") === "asc" ? asc : desc;

  const [items, totalRow] = await Promise.all([
    db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        notes: transactions.notes,
        date: transactions.date,
        rewardPoints: transactions.rewardPoints,
        accountId: transactions.accountId,
        toAccountId: transactions.toAccountId,
        categoryId: transactions.categoryId,
        payeeId: transactions.payeeId,
        accountName: fromAcct.name,
        categoryName: categories.name,
        categoryColor: categories.color,
        payeeName: payees.name,
        payeeColor: payees.color,
      })
      .from(transactions)
      .leftJoin(fromAcct, eq(transactions.accountId, fromAcct.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(payees, eq(transactions.payeeId, payees.id))
      .where(where)
      .orderBy(order(sortField), desc(transactions.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(transactions).where(where),
  ]);

  const total = totalRow[0]?.value ?? 0;
  return ok({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const data = transactionSchema.parse(await req.json());
  await assertAccountsOwned(userId, [data.accountId, data.toAccountId]);
  await assertCategoryOwned(userId, data.categoryId);
  await assertPayeeOwned(userId, data.payeeId);

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: data.accountId,
      toAccountId: data.type === "transfer" ? data.toAccountId! : null,
      categoryId: data.categoryId ?? null,
      payeeId: data.payeeId ?? null,
      amount: data.amount.toFixed(2),
      type: data.type,
      description: data.description ?? null,
      notes: data.notes ?? null,
      date: data.date,
      rewardPoints: data.rewardPoints != null ? data.rewardPoints.toFixed(2) : null,
    })
    .returning();

  await recalcAffected(userId, [data.accountId, data.toAccountId]);
  return created(row);
});
