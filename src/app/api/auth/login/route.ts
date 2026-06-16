import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { route, ok, fail } from "@/lib/http";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

export const POST = route(async (req: Request) => {
  const limit = rateLimit(clientKey(req, "login"), 10, 60_000);
  if (!limit.ok) return fail("Too many attempts. Try again later.", 429);

  const body = loginSchema.parse(await req.json());

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  // Always run a hash comparison to reduce user-enumeration timing leaks.
  const valid = user
    ? await verifyPassword(body.password, user.passwordHash)
    : await verifyPassword(body.password, "$2a$12$0000000000000000000000000000000000000000000000000000");

  if (!user || !valid) return fail("Invalid email or password", 401);

  await createSession({ userId: user.id, email: user.email });
  return ok({ user: { id: user.id, email: user.email, name: user.name } });
});
