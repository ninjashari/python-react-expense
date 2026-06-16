import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { accountUpdateSchema } from "@/lib/validations";
import { route, ok, noContent, fail } from "@/lib/http";
import { recalcAccountBalance } from "@/lib/balance";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);
  if (!row) return fail("Account not found", 404);
  return ok(row);
});

export const PUT = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const data = accountUpdateSchema.parse(await req.json());

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) update.name = data.name;
  if (data.type !== undefined) update.type = data.type;
  if (data.accountNumber !== undefined) update.accountNumber = data.accountNumber;
  if (data.cardNumber !== undefined) update.cardNumber = data.cardNumber;
  if (data.cardExpiryMonth !== undefined) update.cardExpiryMonth = data.cardExpiryMonth;
  if (data.cardExpiryYear !== undefined) update.cardExpiryYear = data.cardExpiryYear;
  if (data.creditLimit !== undefined)
    update.creditLimit = data.creditLimit != null ? data.creditLimit.toFixed(2) : null;
  if (data.billGenerationDate !== undefined) update.billGenerationDate = data.billGenerationDate;
  if (data.paymentDueDate !== undefined) update.paymentDueDate = data.paymentDueDate;
  if (data.interestRate !== undefined)
    update.interestRate = data.interestRate != null ? String(data.interestRate) : null;
  if (data.status !== undefined) update.status = data.status;
  if (data.openingDate !== undefined) update.openingDate = data.openingDate;
  if (data.currency !== undefined) update.currency = data.currency;

  // Changing the opening balance shifts every derived balance.
  const openingChanged = data.balance !== undefined;
  if (openingChanged) update.openingBalance = data.balance!.toFixed(2);

  const [row] = await db
    .update(accounts)
    .set(update)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();
  if (!row) return fail("Account not found", 404);

  if (openingChanged) await recalcAccountBalance(userId, id);
  return ok(row);
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const [row] = await db
    .delete(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning({ id: accounts.id });
  if (!row) return fail("Account not found", 404);
  return noContent();
});
