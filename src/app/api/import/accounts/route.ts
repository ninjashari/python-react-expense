import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok, fail } from "@/lib/http";
import { accountSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { chunk } from "@/lib/utils";

export const runtime = "nodejs";

// Postgres caps bind parameters at 65535 per statement; chunk inserts well under it.
const INSERT_BATCH = 500;

const MAX_ROWS = 10000;

const importSchema = z.array(accountSchema).max(MAX_ROWS);

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await req.json();

  if (Array.isArray(body) && body.length > MAX_ROWS) {
    return fail("Too many rows", 422);
  }

  const rows = importSchema.parse(body);

  const existingAccounts = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const existingNames = new Set(existingAccounts.map((a) => a.name.toLowerCase()));

  const failures: Array<{ row: number; reason: string }> = [];
  const toInsert: (typeof accounts.$inferInsert)[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nameKey = row.name.toLowerCase();
    if (existingNames.has(nameKey)) {
      failures.push({ row: i, reason: `Account "${row.name}" already exists` });
      continue;
    }
    existingNames.add(nameKey);

    const opening = row.balance.toFixed(2);
    toInsert.push({
      userId,
      name: row.name,
      type: row.type,
      openingBalance: opening,
      balance: opening,
      accountNumber: row.accountNumber ?? null,
      cardNumber: row.cardNumber ?? null,
      cardExpiryMonth: row.cardExpiryMonth ?? null,
      cardExpiryYear: row.cardExpiryYear ?? null,
      creditLimit: row.creditLimit != null ? row.creditLimit.toFixed(2) : null,
      billGenerationDate: row.billGenerationDate ?? null,
      paymentDueDate: row.paymentDueDate ?? null,
      interestRate: row.interestRate != null ? String(row.interestRate) : null,
      status: row.status,
      openingDate: row.openingDate ?? null,
      currency: row.currency,
    });
  }

  for (const batch of chunk(toInsert, INSERT_BATCH)) {
    await db.insert(accounts).values(batch);
  }

  logger.info("accounts imported", {
    userId,
    imported: toInsert.length,
    failed: failures.length,
  });
  return ok({ imported: toInsert.length, failed: failures });
});
