import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId, verifyPassword, hashPassword } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validations";
import { route, ok, fail } from "@/lib/http";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();
  const body = changePasswordSchema.parse(await req.json());

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return fail("Unauthorized", 401);

  const valid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!valid) return fail("Current password is incorrect", 400);

  const passwordHash = await hashPassword(body.newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return ok({ success: true });
});
