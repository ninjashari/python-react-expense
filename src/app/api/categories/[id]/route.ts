import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
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
    .update(categories)
    .set(update)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();
  if (!row) return fail("Category not found", 404);
  return ok(row);
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const [row] = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning({ id: categories.id });
  if (!row) return fail("Category not found", 404);
  return noContent();
});
