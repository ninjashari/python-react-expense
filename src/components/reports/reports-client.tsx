"use client";

import { useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DonutChart, type DonutDatum } from "@/components/charts/donut-chart";
import { TrendChart, type TrendDatum } from "@/components/charts/trend-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ReportType = "expense" | "income";
type Period = "this-month" | "last-3-months" | "last-6-months" | "this-year" | "last-12-months";

type CategoryRow = { categoryId: string | null; name: string; color: string; total: number; count: number };
type PayeeRow = { payeeId: string | null; name: string; color: string; total: number; count: number };
type TrendRow = { month: string; income: number; expense: number; net: number };

const PERIODS: { value: Period; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "last-6-months", label: "Last 6 months" },
  { value: "this-year", label: "This year" },
  { value: "last-12-months", label: "Last 12 months" },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Compute inclusive from/to (YYYY-MM-DD) for a period, relative to today. */
function rangeFor(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = iso(now);
  let from: Date;
  switch (period) {
    case "this-month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last-3-months":
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case "last-6-months":
      from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case "this-year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "last-12-months":
      from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: iso(from), to };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06" -> "Jun" */
function shortMonth(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return MONTHS[idx] ?? month;
}

export function ReportsClient() {
  const [period, setPeriod] = useState<Period>("last-6-months");
  const [type, setType] = useState<ReportType>("expense");

  const { from, to } = useMemo(() => rangeFor(period), [period]);
  const qs = `type=${type}&from=${from}&to=${to}`;

  const { data: byCategory, isLoading: catLoading } = useSWR<CategoryRow[]>(
    `/api/reports/by-category?${qs}`,
    fetcher,
  );
  const { data: byPayee, isLoading: payeeLoading } = useSWR<PayeeRow[]>(
    `/api/reports/by-payee?${qs}`,
    fetcher,
  );
  const { data: trend, isLoading: trendLoading } = useSWR<TrendRow[]>(
    "/api/reports/monthly-trend?months=12",
    fetcher,
  );

  const categories = byCategory ?? [];
  const payees = byPayee ?? [];

  const categoryTotal = categories.reduce((sum, c) => sum + c.total, 0);
  const donutData: DonutDatum[] = categories.map((c) => ({
    name: c.name,
    value: c.total,
    color: c.color,
  }));

  const topPayees = payees.slice(0, 10);
  const payeeMax = topPayees.reduce((m, p) => Math.max(m, p.total), 0);

  const trendData: TrendDatum[] = (trend ?? []).map((t) => ({
    month: shortMonth(t.month),
    income: t.income,
    expense: t.expense,
  }));
  const trendIncome = (trend ?? []).reduce((s, t) => s + t.income, 0);
  const trendExpense = (trend ?? []).reduce((s, t) => s + t.expense, 0);

  const typeLabel = type === "expense" ? "Spending" : "Income";

  return (
    <div>
      <PageHeader title="Reports" description="Understand where your money goes.">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={type} onValueChange={(v) => setType(v as ReportType)}>
            <TabsList>
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{typeLabel} by category</CardTitle>
            <CardDescription>
              {formatCurrency(categoryTotal)} total · {categories.length} categor
              {categories.length === 1 ? "y" : "ies"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {catLoading ? (
              <Loading />
            ) : categories.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No data for this period"
                description={`No ${type} transactions found in the selected range.`}
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
                <DonutChart data={donutData} />
                <ul className="space-y-2">
                  {categories.map((c) => {
                    const pct = categoryTotal > 0 ? (c.total / categoryTotal) * 100 : 0;
                    return (
                      <li key={c.categoryId ?? c.name} className="flex items-center gap-3 text-sm">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(c.total)}</span>
                        <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {pct.toFixed(0)}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top payees</CardTitle>
            <CardDescription>By {type} in the selected range</CardDescription>
          </CardHeader>
          <CardContent>
            {payeeLoading ? (
              <Loading />
            ) : topPayees.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No data for this period"
                description={`No ${type} transactions found in the selected range.`}
              />
            ) : (
              <ul className="space-y-3">
                {topPayees.map((p, i) => {
                  const width = payeeMax > 0 ? (p.total / payeeMax) * 100 : 0;
                  return (
                    <li key={p.payeeId ?? p.name} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                            {i + 1}
                          </span>
                          <span
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: p.color }}
                            aria-hidden
                          />
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatCurrency(p.total)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${width}%`, backgroundColor: p.color }}
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Monthly trend</CardTitle>
          <CardDescription>
            Last 12 months · {formatCurrency(trendIncome)} income · {formatCurrency(trendExpense)} expense
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Loading />
          ) : trendData.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No data yet"
              description="Add some transactions to see your monthly trend."
            />
          ) : (
            <TrendChart data={trendData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
