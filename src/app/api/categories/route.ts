import { and, eq, ilike, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { taxonomySchema } from "@/lib/validations";
import { route, ok, created, fail } from "@/lib/http";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const search = new URL(req.url).searchParams.get("search")?.trim();
  const where = search
    ? and(eq(categories.userId, userId), ilike(categories.name, `%${search}%`))
    : eq(categories.userId, userId);

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      color: categories.color,
      txnCount: sql<number>`count(${transactions.id})`,
    })
    .from(categories)
    .leftJoin(transactions, eq(transactions.categoryId, categories.id))
    .where(where)
    .groupBy(categories.id)
    .orderBy(desc(sql`count(${transactions.id})`), categories.name);
  return ok(rows);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const data = taxonomySchema.parse(await req.json());
  const slug = slugify(data.name);

  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.slug, slug)))
    .limit(1);
  if (existing.length) return fail("Category already exists", 409);

  const [row] = await db
    .insert(categories)
    .values({ userId, name: data.name, slug, color: data.color ?? "#6366f1" })
    .returning();
  return created(row);
});
