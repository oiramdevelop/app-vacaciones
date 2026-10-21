"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function VacationsByMonthChart({ data }: { data: { month: string; days: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Gráfico de días de vacaciones por mes">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
          <Tooltip
            cursor={{ fill: "#eef2f7" }}
            formatter={(value) => [`${value} días`, "Vacaciones"]}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="days" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
