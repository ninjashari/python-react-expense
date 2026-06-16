import { requireUserId } from "@/lib/auth";
import { route, ok } from "@/lib/http";
import { recalcAllBalances } from "@/lib/balance";

export const runtime = "nodejs";

export const POST = route(async () => {
  const userId = await requireUserId();
  const count = await recalcAllBalances(userId);
  return ok({ recalculated: count });
});
