import Link from "next/link";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowLeftRight,
  ArrowRight,
} from "lucide-react";
import { db } from "@/db";
import { accounts, transactions, categories, payees } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { DonutChart } from "@/components/charts/donut-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const uid = user.id;
  const since = monthStart();

  const [acctRows, summaryRow, byCategory, recent] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, uid))
      .orderBy(desc(accounts.balance)),
    db
      .select({
        income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
        expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, uid), gte(transactions.date, since))),
    db
      .select({
        name: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
        color: sql<string>`coalesce(${categories.color}, '#94a3b8')`,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, uid),
          eq(transactions.type, "expense"),
          gte(transactions.date, since),
        ),
      )
      .groupBy(categories.name, categories.color)
      .orderBy(desc(sql`sum(${transactions.amount})`))
      .limit(8),
    db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        date: transactions.date,
        accountName: accounts.name,
        categoryName: categories.name,
        categoryColor: categories.color,
        payeeName: payees.name,
      })
      .from(transactions)
      .leftJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(payees, eq(transactions.payeeId, payees.id))
      .where(eq(transactions.userId, uid))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(6),
  ]);

  const totalBalance = acctRows
    .filter((a) => a.status === "active")
    .reduce((sum, a) => sum + Number(a.balance), 0);
  const income = Number(summaryRow[0]?.income ?? 0);
  const expense = Number(summaryRow[0]?.expense ?? 0);
  const donut = byCategory.map((c) => ({
    name: c.name,
    value: Number(c.total),
    color: c.color,
  }));

  const stats = [
    {
      label: "Total balance",
      value: totalBalance,
      icon: Wallet,
      tint: "text-primary",
    },
    { label: "Income (this month)", value: income, icon: TrendingUp, tint: "text-emerald-500" },
    { label: "Expenses (this month)", value: expense, icon: TrendingDown, tint: "text-rose-500" },
    {
      label: "Net (this month)",
      value: income - expense,
      icon: ArrowLeftRight,
      tint: "text-sky-500",
    },
  ];

  return (
    <div>
      <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description="Here's your financial overview.">
        <Button asChild>
          <Link href="/transactions">
            New transaction <ArrowRight className="size-4" />
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-semibold tabular-nums">{formatCurrency(s.value)}</p>
              </div>
              <div className={cn("rounded-full bg-muted p-3", s.tint)}>
                <s.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>Your latest activity</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/transactions">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recent.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No transactions yet. Add your first one.
              </p>
            )}
            {recent.map((t) => {
              const positive = t.type === "income";
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.payeeName || t.description || "Transaction"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.accountName} · {t.categoryName ?? "Uncategorized"} · {formatDate(t.date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      positive ? "text-emerald-500" : "text-foreground",
                    )}
                  >
                    {positive ? "+" : t.type === "expense" ? "−" : ""}
                    {formatCurrency(Number(t.amount))}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by category</CardTitle>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={donut} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>{acctRows.length} account(s)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {acctRows.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              No accounts yet.{" "}
              <Link href="/accounts" className="text-primary hover:underline">
                Create one
              </Link>
              .
            </p>
          )}
          {acctRows.map((a) => (
            <Link
              key={a.id}
              href="/accounts"
              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{a.type}</p>
              </div>
              <span className="font-semibold tabular-nums">{formatCurrency(Number(a.balance), a.currency)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
