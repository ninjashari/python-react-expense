"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Download, Loader2 } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DonutChart, type DonutDatum } from "@/components/charts/donut-chart";
import { TrendChart, type TrendDatum } from "@/components/charts/trend-chart";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReportType = "expense" | "income";
type Period = "this-month" | "last-3-months" | "last-6-months" | "this-year" | "last-12-months";

type CategoryRow = { categoryId: string | null; name: string; color: string; total: number; count: number };
type PayeeRow = { payeeId: string | null; name: string; color: string; total: number; count: number };
type TrendRow = { month: string; income: number; expense: number; net: number };
type MonthCatRow = { month: string; categoryId: string | null; name: string; color: string; total: number };

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

function monthsForPeriod(period: Period): number {
  const now = new Date();
  switch (period) {
    case "this-month":
      return 1;
    case "last-3-months":
      return 3;
    case "last-6-months":
      return 6;
    case "this-year":
      return now.getMonth() + 1;
    case "last-12-months":
      return 12;
    default:
      return 6;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06" -> "Jun" */
function shortMonth(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return MONTHS[idx] ?? month;
}

/** "2026-06" -> "Jun '26" */
function monthLabel(month: string): string {
  return `${shortMonth(month)} '${month.slice(2, 4)}`;
}

/** Last `count` months ending this month, as "YYYY-MM", oldest first. */
function recentMonths(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportsClient() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("last-6-months");
  const [type, setType] = useState<ReportType>("expense");

  const { from, to } = useMemo(() => rangeFor(period), [period]);
  const qs = `type=${type}&from=${from}&to=${to}`;
  const monthsCount = monthsForPeriod(period);

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
  const { data: monthCat, isLoading: monthCatLoading } = useSWR<MonthCatRow[]>(
    `/api/reports/monthly-category?type=${type}&months=${monthsCount}`,
    fetcher,
  );

  const categories = byCategory ?? [];
  const payees = byPayee ?? [];

  // Drill into the transaction list with the report's filters pre-applied.
  function drillTo(extra: Record<string, string>) {
    const params = new URLSearchParams({ type, from, to, ...extra });
    router.push(`/transactions?${params.toString()}`);
  }

  const categoryTotal = categories.reduce((sum, c) => sum + c.total, 0);
  const donutData: DonutDatum[] = categories.map((c) => ({
    name: c.name,
    value: c.total,
    color: c.color,
    id: c.categoryId,
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

  // --- Monthwise category matrix ---
  const monthCols = useMemo(() => recentMonths(monthsCount), [monthsCount]);
  const matrix = useMemo(() => {
    const rows = monthCat ?? [];
    const byCat = new Map<
      string,
      { name: string; color: string; perMonth: Map<string, number>; total: number }
    >();
    for (const r of rows) {
      const key = r.categoryId ?? "__uncat__";
      let entry = byCat.get(key);
      if (!entry) {
        entry = { name: r.name, color: r.color, perMonth: new Map(), total: 0 };
        byCat.set(key, entry);
      }
      entry.perMonth.set(r.month, (entry.perMonth.get(r.month) ?? 0) + r.total);
      entry.total += r.total;
    }
    const perMonthTotals = new Map<string, number>();
    for (const entry of byCat.values()) {
      for (const m of monthCols) {
        perMonthTotals.set(m, (perMonthTotals.get(m) ?? 0) + (entry.perMonth.get(m) ?? 0));
      }
    }
    const grandTotal = [...byCat.values()].reduce((s, e) => s + e.total, 0);
    const list = [...byCat.entries()]
      .map(([key, e]) => ({ key, ...e }))
      .sort((a, b) => b.total - a.total);
    return { list, perMonthTotals, grandTotal };
  }, [monthCat, monthCols]);

  function exportMatrixCsv() {
    const header = ["Category", ...monthCols.map(monthLabel), "Total"];
    const lines = [header.map(csvField).join(",")];
    for (const row of matrix.list) {
      lines.push(
        [
          row.name,
          ...monthCols.map((m) => (row.perMonth.get(m) ?? 0).toFixed(2)),
          row.total.toFixed(2),
        ]
          .map(csvField)
          .join(","),
      );
    }
    lines.push(
      [
        "Total",
        ...monthCols.map((m) => (matrix.perMonthTotals.get(m) ?? 0).toFixed(2)),
        matrix.grandTotal.toFixed(2),
      ]
        .map(csvField)
        .join(","),
    );
    downloadCsv(`${type}-by-category-monthly.csv`, lines.join("\n"));
  }

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
              {categories.length === 1 ? "y" : "ies"} · click to drill in
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
                <DonutChart
                  data={donutData}
                  onSelect={(d) => d.id && drillTo({ categoryId: d.id })}
                />
                <ul className="space-y-2">
                  {categories.map((c) => {
                    const pct = categoryTotal > 0 ? (c.total / categoryTotal) * 100 : 0;
                    const content = (
                      <>
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
                        <span className="shrink-0 tabular-nums">{formatCurrency(c.total)}</span>
                        <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {pct.toFixed(0)}%
                        </span>
                      </>
                    );
                    return (
                      <li key={c.categoryId ?? c.name}>
                        {c.categoryId ? (
                          <button
                            type="button"
                            onClick={() => drillTo({ categoryId: c.categoryId! })}
                            className="flex w-full items-center gap-3 rounded-sm px-1 py-0.5 text-sm hover:bg-muted"
                          >
                            {content}
                          </button>
                        ) : (
                          <span className="flex w-full items-center gap-3 px-1 py-0.5 text-sm">
                            {content}
                          </span>
                        )}
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
            <CardDescription>By {type} in the selected range · click to drill in</CardDescription>
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
                  const inner = (
                    <>
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
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${width}%`, background: `linear-gradient(90deg, ${p.color}, ${p.color}dd)` }}
                        />
                      </div>
                    </>
                  );
                  return (
                    <li key={p.payeeId ?? p.name}>
                      {p.payeeId ? (
                        <button
                          type="button"
                          onClick={() => drillTo({ payeeId: p.payeeId! })}
                          className="block w-full rounded-sm px-1 py-0.5 text-left hover:bg-muted"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="px-1 py-0.5">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthwise category breakdown */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{typeLabel} by category, by month</CardTitle>
            <CardDescription>
              {monthsCount} month{monthsCount === 1 ? "" : "s"} · {matrix.list.length} categor
              {matrix.list.length === 1 ? "y" : "ies"}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportMatrixCsv}
            disabled={matrix.list.length === 0}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {monthCatLoading ? (
            <Loading />
          ) : matrix.list.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No data for this period"
              description={`No ${type} transactions found in the selected range.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">Category</TableHead>
                    {monthCols.map((m) => (
                      <TableHead key={m} className="text-right whitespace-nowrap">
                        {monthLabel(m)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.list.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="sticky left-0 bg-card font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          {row.name}
                        </span>
                      </TableCell>
                      {monthCols.map((m) => {
                        const v = row.perMonth.get(m) ?? 0;
                        return (
                          <TableCell
                            key={m}
                            className="text-right tabular-nums text-muted-foreground"
                          >
                            {v ? formatCurrency(v) : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell className="sticky left-0 bg-card font-semibold">Total</TableCell>
                    {monthCols.map((m) => (
                      <TableCell key={m} className="text-right font-semibold tabular-nums">
                        {formatCurrency(matrix.perMonthTotals.get(m) ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(matrix.grandTotal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
