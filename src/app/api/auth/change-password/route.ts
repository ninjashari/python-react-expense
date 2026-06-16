import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId, verifyPassword, hashPassword, createSession } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validations";
import { route, ok, fail } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const userId = await requireUserId();

  const limit = rateLimit(`change-password:${userId}`, 5, 60_000);
  if (!limit.ok) return fail("Too many attempts. Try again later.", 429);

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

  // Rotate the current session token after a credential change.
  await createSession({ userId: user.id, email: user.email });
  return ok({ success: true });
});
