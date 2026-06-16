import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { route, ok, fail } from "@/lib/http";

export const runtime = "nodejs";

export const GET = route(async () => {
  const session = await getSession();
  if (!session) return fail("Unauthorized", 401);
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return fail("Unauthorized", 401);
  return ok({ user });
});
