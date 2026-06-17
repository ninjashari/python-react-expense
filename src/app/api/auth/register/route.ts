import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { route, created, fail } from "@/lib/http";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const limit = rateLimit(clientKey(req, "register"), 5, 60_000);
  if (!limit.ok) return fail("Too many attempts. Try again later.", 429);

  const body = registerSchema.parse(await req.json());

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);
  if (existing.length) return fail("Email already registered", 409);

  const passwordHash = await hashPassword(body.password);
  const [user] = await db
    .insert(users)
    .values({ name: body.name, email: body.email, passwordHash })
    .returning({ id: users.id, email: users.email, name: users.name });

  await createSession({ userId: user.id, email: user.email });
  logger.info("user registered", { userId: user.id });
  return created({ user });
});
