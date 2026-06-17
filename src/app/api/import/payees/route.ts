import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { payees } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, ok, fail } from "@/lib/http";
import { taxonomySchema } from "@/lib/validations";
import { slugify, chunk } from "@/lib/utils";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Postgres caps bind parameters at 65535 per statement; chunk inserts well under it.
const INSERT_BATCH = 500;

const MAX_ROWS = 10000;

const importSchema = z.array(taxonomySchema).max(MAX_ROWS);

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = await req.json();

  if (Array.isArray(body) && body.length > MAX_ROWS) {
    return fail("Too many rows", 422);
  }

  const rows = importSchema.parse(body);

  const existingPayees = await db
    .select({ slug: payees.slug })
    .from(payees)
    .where(eq(payees.userId, userId));
  const existingSlugs = new Set(existingPayees.map((p) => p.slug));

  const failures: Array<{ row: number; reason: string }> = [];
  const toInsert: (typeof payees.$inferInsert)[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const slug = slugify(row.name);
    if (existingSlugs.has(slug)) {
      failures.push({ row: i, reason: `Payee "${row.name}" already exists` });
      continue;
    }
    existingSlugs.add(slug);
    toInsert.push({ userId, name: row.name, slug, color: row.color ?? "#10b981" });
  }

  for (const batch of chunk(toInsert, INSERT_BATCH)) {
    await db.insert(payees).values(batch);
  }

  logger.info("payees imported", {
    userId,
    imported: toInsert.length,
    failed: failures.length,
  });
  return ok({ imported: toInsert.length, failed: failures });
});
