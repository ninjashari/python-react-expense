"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

export type DonutDatum = { name: string; value: number; color: string; id?: string | null };

export function DonutChart({
  data,
  onSelect,
}: {
  data: DonutDatum[];
  onSelect?: (datum: DonutDatum) => void;
}) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data for this period.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={256}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={64}
          outerRadius={96}
          paddingAngle={2}
          stroke="none"
          onClick={onSelect ? (_, index) => onSelect(data[index]) : undefined}
        >
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.color}
              className={onSelect ? "cursor-pointer outline-none" : "outline-none"}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name)]}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--popover-foreground)",
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
