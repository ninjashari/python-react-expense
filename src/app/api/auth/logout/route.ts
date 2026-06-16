import { destroySession } from "@/lib/auth";
import { route, ok } from "@/lib/http";

export const runtime = "nodejs";

export const POST = route(async () => {
  await destroySession();
  return ok({ success: true });
});
