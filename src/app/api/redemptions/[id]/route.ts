import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { rewardRedemptions } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { route, noContent, fail } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;

  const [row] = await db
    .delete(rewardRedemptions)
    .where(and(eq(rewardRedemptions.id, id), eq(rewardRedemptions.userId, userId)))
    .returning({ id: rewardRedemptions.id });

  if (!row) return fail("Not found", 404);
  return noContent();
});
