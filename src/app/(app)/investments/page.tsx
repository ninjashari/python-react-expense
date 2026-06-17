import Link from "next/link";
import { and, eq, gte, desc, inArray, sql } from "drizzle-orm";
import {
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  Layers,
  Wallet,
  ArrowRight,
  Percent,
} from "lucide-react";
import { db } from "@/db";
import { accounts, transactions, categories } from "@/db/schema";
import { getCurrentUser } from "@/lib/current-user";
import { formatCurrency, cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DonutChart, type DonutDatum } from "@/components/charts/donut-chart";
import { TrendChart, type TrendDatum } from "@/components/charts/trend-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

// Investment-bearing account types analysed on this page.
const INVESTMENT_TYPES = ["investment", "ppf"] as const;

// Stable palette so each account keeps the same colour across the donut and table.
const ACCOUNT_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#3b82f6",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06" -> "Jun" */
function shortMonth(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return MONTHS[idx] ?? month;
}

/** Last 12 months as "YYYY-MM", oldest first, plus the inclusive start date. */
function last12Months(): { keys: string[]; since: string } {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return { keys, since: start.toISOString().slice(0, 10) };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function InvestmentsPage() {
  const user = await getCurrentUser();
  const uid = user.id;

  const invAccounts = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, uid), inArray(accounts.type, [...INVESTMENT_TYPES])))
    .orderBy(desc(accounts.balance));

  if (invAccounts.length === 0) {
    return (
      <div>
        <PageHeader
          title="Investments"
          description="Analyse your investment and PPF accounts."
        />
        <EmptyState
          icon={LineChartIcon}
          title="No investment accounts yet"
          description="Add an account of type Investment or PPF to see holdings, contributions and growth here."
          action={
            <Button asChild>
              <Link href="/accounts">
                Go to accounts <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const invIds = invAccounts.map((a) => a.id);
  const { keys: monthKeys, since } = last12Months();

  const accIn = inArray(transactions.accountId, invIds);
  const toIn = inArray(transactions.toAccountId, invIds);

  const [primaryRows, transferInRows, byCategory, monthlyRows] = await Promise.all([
    // Income / expense / outgoing transfers recorded on each investment account.
    db
      .select({
        accountId: transactions.accountId,
        income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
        expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
        transferOut: sql<string>`coalesce(sum(case when ${transactions.type} = 'transfer' then ${transactions.amount} else 0 end), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, uid), accIn))
      .groupBy(transactions.accountId),
    // Transfers landing in an investment account (contributions from other accounts).
    db
      .select({
        accountId: transactions.toAccountId,
        transferIn: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, uid), eq(transactions.type, "transfer"), toIn))
      .groupBy(transactions.toAccountId),
    // How activity on investment accounts breaks down by category.
    db
      .select({
        categoryId: transactions.categoryId,
        name: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
        color: sql<string>`coalesce(${categories.color}, '#94a3b8')`,
        total: sql<string>`sum(${transactions.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.userId, uid), accIn))
      .groupBy(transactions.categoryId, categories.name, categories.color)
      .orderBy(desc(sql`sum(${transactions.amount})`)),
    // Monthly inflow vs outflow across all investment accounts (last 12 months).
    db
      .select({
        month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        inflow: sql<string>`coalesce(sum(case
          when (${transactions.type} = 'income' and ${accIn})
            or (${transactions.type} = 'transfer' and ${toIn})
          then ${transactions.amount} else 0 end), 0)`,
        outflow: sql<string>`coalesce(sum(case
          when (${transactions.type} = 'expense' and ${accIn})
            or (${transactions.type} = 'transfer' and ${accIn})
          then ${transactions.amount} else 0 end), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, uid),
          gte(transactions.date, since),
          sql`(${accIn} or ${toIn})`,
        ),
      )
      .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`),
  ]);

  // Merge per-account inflow/outflow figures keyed by account id.
  const primaryByAccount = new Map(primaryRows.map((r) => [r.accountId, r]));
  const transferInByAccount = new Map(
    transferInRows.map((r) => [r.accountId as string, Number(r.transferIn)]),
  );

  const currency = invAccounts[0].currency;

  const accountStats = invAccounts.map((a, i) => {
    const p = primaryByAccount.get(a.id);
    const income = Number(p?.income ?? 0);
    const expense = Number(p?.expense ?? 0);
    const transferOut = Number(p?.transferOut ?? 0);
    const transferIn = transferInByAccount.get(a.id) ?? 0;
    const inflow = income + transferIn;
    const outflow = expense + transferOut;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance),
      interestRate: a.interestRate != null ? Number(a.interestRate) : null,
      color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      inflow,
      outflow,
    };
  });

  const totalHoldings = accountStats.reduce((s, a) => s + a.balance, 0);
  const totalInflow = accountStats.reduce((s, a) => s + a.inflow, 0);
  const totalOutflow = accountStats.reduce((s, a) => s + a.outflow, 0);
  const netFlow = totalInflow - totalOutflow;

  const allocation: DonutDatum[] = accountStats
    .filter((a) => a.balance > 0)
    .map((a) => ({ name: a.name, value: a.balance, color: a.color }));

  const monthByKey = new Map(monthlyRows.map((r) => [r.month, r]));
  const trendData: TrendDatum[] = monthKeys.map((m) => {
    const row = monthByKey.get(m);
    return {
      month: shortMonth(m),
      income: Number(row?.inflow ?? 0),
      expense: Number(row?.outflow ?? 0),
    };
  });

  const categoryRows = byCategory.map((c) => ({ ...c, total: Number(c.total) }));
  const categoryTotal = categoryRows.reduce((s, c) => s + c.total, 0);

  const stats = [
    {
      label: "Total holdings",
      value: totalHoldings,
      icon: Wallet,
      gradient: "from-indigo-500 to-purple-600",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-400",
    },
    {
      label: "Inflows (all time)",
      value: totalInflow,
      icon: TrendingUp,
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400",
    },
    {
      label: "Outflows (all time)",
      value: totalOutflow,
      icon: TrendingDown,
      gradient: "from-rose-500 to-pink-600",
      iconBg: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-400",
    },
    {
      label: "Net invested",
      value: netFlow,
      icon: Layers,
      gradient: "from-sky-500 to-cyan-600",
      iconBg: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Investments"
        description={`${invAccounts.length} investment account${invAccounts.length === 1 ? "" : "s"} · holdings, contributions and growth.`}
      >
        <Button asChild variant="outline">
          <Link href="/transactions?type=transfer">
            View transactions <ArrowRight className="size-4" />
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
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(s.value, currency)}</p>
              </div>
              <div className={cn("rounded-xl p-3 transition-transform duration-200 group-hover:scale-110", s.iconBg)}>
                <s.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>Holdings by account</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={allocation} />
            <ul className="mt-4 space-y-2">
              {accountStats
                .filter((a) => a.balance > 0)
                .map((a) => {
                  const pct = totalHoldings > 0 ? (a.balance / totalHoldings) * 100 : 0;
                  return (
                    <li key={a.id} className="flex items-center gap-3 text-sm">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: a.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="shrink-0 tabular-nums">{formatCurrency(a.balance, currency)}</span>
                      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {pct.toFixed(0)}%
                      </span>
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contribution trend</CardTitle>
            <CardDescription>Inflows vs outflows · last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} incomeLabel="Inflows" expenseLabel="Outflows" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Per-account holdings and lifetime flows</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Inflows</TableHead>
                <TableHead className="text-right">Outflows</TableHead>
                <TableHead className="text-right">Holdings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountStats.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: a.color }}
                        aria-hidden
                      />
                      {a.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{capitalize(a.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {a.interestRate != null ? (
                      <span className="inline-flex items-center gap-0.5">
                        {a.interestRate}
                        <Percent className="size-3" />
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {a.inflow ? formatCurrency(a.inflow, currency) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-rose-600 dark:text-rose-400">
                    {a.outflow ? formatCurrency(a.outflow, currency) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(a.balance, currency)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalInflow, currency)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatCurrency(totalOutflow, currency)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(totalHoldings, currency)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Activity by category</CardTitle>
          <CardDescription>
            How transactions on your investment accounts are categorised
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoryRows.length === 0 ? (
            <EmptyState
              icon={LineChartIcon}
              title="No categorised activity yet"
              description="Income, dividends or fees recorded on investment accounts will appear here, grouped by category."
            />
          ) : (
            <ul className="space-y-3">
              {categoryRows.map((c) => {
                const width = categoryTotal > 0 ? (c.total / categoryTotal) * 100 : 0;
                return (
                  <li key={c.categoryId ?? c.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                        <span className="truncate">{c.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          · {c.count} txn{c.count === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatCurrency(c.total, currency)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${width}%`, background: `linear-gradient(90deg, ${c.color}, ${c.color}dd)` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
