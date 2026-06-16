import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { RewardsClient } from "@/components/rewards/rewards-client";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const user = await getCurrentUser();

  const creditAccounts = await db
    .select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.type, "credit")))
    .orderBy(asc(accounts.name));

  return <RewardsClient accounts={creditAccounts} />;
}
