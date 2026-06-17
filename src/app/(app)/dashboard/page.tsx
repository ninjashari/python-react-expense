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
      gradient: "from-indigo-500 to-purple-600",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-400",
    },
    {
      label: "Income (this month)",
      value: income,
      icon: TrendingUp,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400",
    },
    {
      label: "Expenses (this month)",
      value: expense,
      icon: TrendingDown,
      gradient: "from-rose-500 to-pink-600",
      iconBg: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-400",
    },
    {
      label: "Net (this month)",
      value: income - expense,
      icon: ArrowLeftRight,
      gradient: "from-sky-500 to-cyan-600",
      iconBg: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400",
    },
  ];

  return (
    <div>
      <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description="Here's your financial overview.">
        <Button asChild className="gradient-primary border-0 text-white shadow-md hover:opacity-90">
          <Link href="/transactions">
            New transaction <ArrowRight className="size-4" />
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="group relative overflow-hidden transition-shadow hover:shadow-md">
            <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", s.gradient)} />
            <CardContent className="flex items-center justify-between p-5 pt-6">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(s.value)}</p>
              </div>
              <div className={cn("rounded-xl p-3 transition-transform duration-200 group-hover:scale-110", s.iconBg)}>
                <s.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
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
          <CardContent className="space-y-0.5">
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
                  className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                      positive
                        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400"
                        : t.type === "transfer"
                          ? "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400"
                          : "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-400",
                    )}>
                      {positive ? "+" : t.type === "expense" ? "−" : "⇄"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t.payeeName || t.description || "Transaction"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.accountName} · {t.categoryName ?? "Uncategorized"} · {formatDate(t.date)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      positive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
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

      <Card className="mt-8">
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
              className="group flex items-center justify-between rounded-xl border p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
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
