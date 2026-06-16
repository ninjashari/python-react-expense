import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payees } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { taxonomyUpdateSchema } from "@/lib/validations";
import { route, ok, noContent, fail } from "@/lib/http";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const data = taxonomyUpdateSchema.parse(await req.json());

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) {
    update.name = data.name;
    update.slug = slugify(data.name);
  }
  if (data.color !== undefined) update.color = data.color;

  const [row] = await db
    .update(payees)
    .set(update)
    .where(and(eq(payees.id, id), eq(payees.userId, userId)))
    .returning();
  if (!row) return fail("Payee not found", 404);
  return ok(row);
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const [row] = await db
    .delete(payees)
    .where(and(eq(payees.id, id), eq(payees.userId, userId)))
    .returning({ id: payees.id });
  if (!row) return fail("Payee not found", 404);
  return noContent();
});
