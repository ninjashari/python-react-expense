import { and, eq, ilike, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { payees, transactions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { taxonomySchema } from "@/lib/validations";
import { route, ok, created, fail } from "@/lib/http";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

export const GET = route(async (req: Request) => {
  const userId = await requireUserId();
  const search = new URL(req.url).searchParams.get("search")?.trim();
  const where = search
    ? and(eq(payees.userId, userId), ilike(payees.name, `%${search}%`))
    : eq(payees.userId, userId);

  const rows = await db
    .select({
      id: payees.id,
      name: payees.name,
      slug: payees.slug,
      color: payees.color,
      txnCount: sql<number>`count(${transactions.id})`,
    })
    .from(payees)
    .leftJoin(transactions, eq(transactions.payeeId, payees.id))
    .where(where)
    .groupBy(payees.id)
    .orderBy(desc(sql`count(${transactions.id})`), payees.name);
  return ok(rows);
});

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const data = taxonomySchema.parse(await req.json());
  const slug = slugify(data.name);

  const existing = await db
    .select({ id: payees.id })
    .from(payees)
    .where(and(eq(payees.userId, userId), eq(payees.slug, slug)))
    .limit(1);
  if (existing.length) return fail("Payee already exists", 409);

  const [row] = await db
    .insert(payees)
    .values({ userId, name: data.name, slug, color: data.color ?? "#10b981" })
    .returning();
  return created(row);
});
