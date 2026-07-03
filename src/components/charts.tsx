"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/lib/format";
import type {
  AssuntoDist,
  CanalDist,
  DestinoRanking,
  NpsDist,
  ResolucaoDist,
  SerieTemporal,
} from "@/lib/types";
import { CANAL_LABEL } from "@/lib/format";

const axis = { fontSize: 12, fill: "var(--muted)" };
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  fontSize: 12,
};

export function DestinosBar({ data }: { data: DestinoRanking[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={axis} allowDecimals={false} />
        <YAxis type="category" dataKey="destino" width={120} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Conversas"]} />
        <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="var(--chart-1)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AssuntosBar({ data }: { data: AssuntoDist[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={axis} allowDecimals={false} />
        <YAxis type="category" dataKey="assunto" width={180} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Conversas"]} />
        <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="var(--chart-2)" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Donut({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CanalDonut({ data }: { data: CanalDist[] }) {
  const d = data.map((c) => ({ name: CANAL_LABEL[c.canal], value: c.total }));
  return (
    <div>
      <Donut data={d} colors={CHART_COLORS} />
      <Legend items={d.map((x, i) => ({ label: x.name, color: CHART_COLORS[i], value: x.value }))} />
    </div>
  );
}

export function ResolucaoDonut({ data }: { data: ResolucaoDist }) {
  const d = [
    { name: "Resolvidas", value: data.resolvidas },
    { name: "Parciais", value: data.parciais },
    { name: "Não resolvidas", value: data.naoResolvidas },
  ];
  const colors = ["var(--positivo)", "var(--neutro)", "var(--negativo)"];
  return (
    <div>
      <Donut data={d} colors={colors} />
      <Legend items={d.map((x, i) => ({ label: x.name, color: colors[i], value: x.value }))} />
    </div>
  );
}

export function NpsBar({ data }: { data: NpsDist }) {
  const d = [
    { name: "Detratores", value: data.detratores, fill: "var(--negativo)" },
    { name: "Neutros", value: data.neutros, fill: "var(--neutro)" },
    { name: "Promotores", value: data.promotores, fill: "var(--positivo)" },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={d} margin={{ left: -10 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={axis} />
        <YAxis tick={axis} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Conversas"]} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {d.map((e, i) => (
            <Cell key={i} fill={e.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const fmtDia = (d: unknown) =>
  new Date(String(d) + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

export function VolumeLine({ data }: { data: SerieTemporal[] }) {
  const fmt = fmtDia;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -10, right: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="data" tickFormatter={fmt} tick={axis} minTickGap={24} />
        <YAxis tick={axis} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={fmt}
          formatter={(v) => [v, "Conversas"]}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SentimentoLine({ data }: { data: SerieTemporal[] }) {
  const fmt = fmtDia;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: -10, right: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="data" tickFormatter={fmt} tick={axis} minTickGap={24} />
        <YAxis domain={[-1, 1]} tick={axis} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={fmt}
          formatter={(v: unknown) => [Number(v).toFixed(2), "Sentimento médio"]}
        />
        <Line
          type="monotone"
          dataKey="sentimentoMedio"
          stroke="var(--chart-3)"
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Legend({
  items,
}: {
  items: { label: string; color: string; value: number }[];
}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: it.color }}
          />
          {it.label} <span className="font-medium text-foreground">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}
