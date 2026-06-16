import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, categories, payees, transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok, fail } from "@/lib/http";
import { transactionTypeValues } from "@/lib/validations";
import { recalcAffected } from "@/lib/transactions-service";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

const MAX_ROWS = 2000;

const money = z
  .union([z.number(), z.string()])
  .transform((v) => Number(v))
  .pipe(z.number().finite());

const importRowSchema = z.object({
  date: z.string().min(1),
  amount: money,
  type: z.enum(transactionTypeValues),
  accountName: z.string().min(1),
  toAccountName: z.string().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  payeeName: z.string().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const importSchema = z.array(importRowSchema).max(MAX_ROWS);

type ImportRow = z.infer<typeof importRowSchema>;

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await req.json();

  if (Array.isArray(body) && body.length > MAX_ROWS) {
    return fail("Too many rows", 422);
  }

  const rows = importSchema.parse(body) as ImportRow[];

  const userAccounts = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const accountByName = new Map(userAccounts.map((a) => [a.name.toLowerCase(), a.id]));

  const userCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId));
  const categoryByName = new Map(userCategories.map((c) => [c.name.toLowerCase(), c.id]));

  const userPayees = await db
    .select({ id: payees.id, name: payees.name })
    .from(payees)
    .where(eq(payees.userId, userId));
  const payeeByName = new Map(userPayees.map((p) => [p.name.toLowerCase(), p.id]));

  const failures: Array<{ row: number; reason: string }> = [];
  const toInsert: (typeof transactions.$inferInsert)[] = [];
  const touchedAccountIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const accountId = accountByName.get(row.accountName.trim().toLowerCase());
    if (!accountId) {
      failures.push({ row: i, reason: `Account "${row.accountName}" not found` });
      continue;
    }

    let toAccountId: string | null = null;
    if (row.type === "transfer") {
      const toName = row.toAccountName?.trim();
      if (!toName) {
        failures.push({ row: i, reason: "Transfers require a destination account" });
        continue;
      }
      const resolvedToId = accountByName.get(toName.toLowerCase());
      if (!resolvedToId) {
        failures.push({ row: i, reason: `Account "${toName}" not found` });
        continue;
      }
      if (resolvedToId === accountId) {
        failures.push({ row: i, reason: "Cannot transfer to the same account" });
        continue;
      }
      toAccountId = resolvedToId;
    }

    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      failures.push({ row: i, reason: "Amount must be greater than 0" });
      continue;
    }

    let categoryId: string | null = null;
    const categoryName = row.categoryName?.trim();
    if (categoryName) {
      const existing = categoryByName.get(categoryName.toLowerCase());
      if (existing) {
        categoryId = existing;
      } else {
        const slug = slugify(categoryName);
        const [created] = await db
          .insert(categories)
          .values({ userId, name: categoryName, slug, color: "#6366f1" })
          .returning({ id: categories.id });
        categoryId = created.id;
        categoryByName.set(categoryName.toLowerCase(), categoryId);
      }
    }

    let payeeId: string | null = null;
    const payeeName = row.payeeName?.trim();
    if (payeeName) {
      const existing = payeeByName.get(payeeName.toLowerCase());
      if (existing) {
        payeeId = existing;
      } else {
        const slug = slugify(payeeName);
        const [created] = await db
          .insert(payees)
          .values({ userId, name: payeeName, slug, color: "#10b981" })
          .returning({ id: payees.id });
        payeeId = created.id;
        payeeByName.set(payeeName.toLowerCase(), payeeId);
      }
    }

    toInsert.push({
      userId,
      accountId,
      toAccountId: row.type === "transfer" ? toAccountId : null,
      categoryId,
      payeeId,
      amount: row.amount.toFixed(2),
      type: row.type,
      description: row.description?.trim() || null,
      notes: row.notes?.trim() || null,
      date: row.date,
    });
    touchedAccountIds.add(accountId);
    if (toAccountId) touchedAccountIds.add(toAccountId);
  }

  if (toInsert.length > 0) {
    await db.insert(transactions).values(toInsert);
  }

  await recalcAffected(userId, [...touchedAccountIds]);

  return ok({ imported: toInsert.length, failed: failures });
});
