"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Kolory z walidowanej palety referencyjnej (references/palette.md, skill dataviz).
const BLUE = "#2a78d6";
const GRID = "#e1e0d9";
const MUTED = "#898781";
const INK = "#0b0b0b";

export function RankedBarChart({
  data,
  valueLabel,
}: {
  data: { name: string; value: number }[];
  valueLabel: string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-400">
        Brak danych w wybranym okresie.
      </p>
    );
  }

  const height = Math.max(100, data.length * 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
        barCategoryGap={8}
      >
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis
          type="number"
          tick={{ fill: MUTED, fontSize: 12 }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fill: INK, fontSize: 13 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
          formatter={(value) => [`${value} ${valueLabel}`, ""]}
          contentStyle={{
            borderRadius: 8,
            borderColor: GRID,
            fontSize: 13,
            color: INK,
          }}
        />
        <Bar dataKey="value" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={24}>
          <LabelList
            dataKey="value"
            position="right"
            style={{ fill: INK, fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
