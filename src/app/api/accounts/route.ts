import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { accountSchema } from "@/lib/validations";
import { route, ok, created } from "@/lib/http";

export const runtime = "nodejs";

export const GET = route(async () => {
  const userId = await requireUserId();
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(desc(accounts.createdAt));
  return ok(rows);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const data = accountSchema.parse(await req.json());
  const opening = data.balance.toFixed(2);
  const [row] = await db
    .insert(accounts)
    .values({
      userId,
      name: data.name,
      type: data.type,
      openingBalance: opening,
      balance: opening,
      accountNumber: data.accountNumber ?? null,
      cardNumber: data.cardNumber ?? null,
      cardExpiryMonth: data.cardExpiryMonth ?? null,
      cardExpiryYear: data.cardExpiryYear ?? null,
      creditLimit: data.creditLimit != null ? data.creditLimit.toFixed(2) : null,
      billGenerationDate: data.billGenerationDate ?? null,
      paymentDueDate: data.paymentDueDate ?? null,
      interestRate: data.interestRate != null ? String(data.interestRate) : null,
      status: data.status,
      openingDate: data.openingDate ?? null,
      currency: data.currency,
    })
    .returning();
  return created(row);
});
