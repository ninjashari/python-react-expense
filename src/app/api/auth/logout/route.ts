import { destroySession, getSession } from "@/lib/auth";
import { route, ok } from "@/lib/http";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export const POST = route(async () => {
  const session = await getSession();
  await destroySession();
  logger.info("logout", { userId: session?.userId });
  return ok({ success: true });
});
