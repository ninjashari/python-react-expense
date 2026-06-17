"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export type TrendDatum = { month: string; income: number; expense: number };

export function TrendChart({
  data,
  incomeLabel = "Income",
  expenseLabel = "Expense",
}: {
  data: TrendDatum[];
  incomeLabel?: string;
  expenseLabel?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No transactions yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={288}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => formatCurrency(v).replace(/\.00$/, "")}
        />
        <Tooltip
          formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name)]}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
          cursor={{ fill: "var(--accent)", opacity: 0.4 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name={incomeLabel} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name={expenseLabel} fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
