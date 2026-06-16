import { getCurrentUser } from "@/lib/current-user";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
