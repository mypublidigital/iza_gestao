"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { canalLabel } from "@/lib/format";

const PERIODOS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
];

export default function FilterBar({
  tags,
  channels,
  atendentes = [],
}: {
  tags: string[];
  channels: string[];
  atendentes?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const periodo = params.get("periodo") ?? "30";
  const canal = params.get("canal") ?? "todos";
  const tag = params.get("tag") ?? "todas";
  const atendente = params.get("atendente") ?? "todos";
  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";
  const rangeAtivo = Boolean(de);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "" || value === "todos" || value === "todas") next.delete(key);
      else next.set(key, value);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const selectCls =
    "rounded-lg border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";
  const dateCls =
    "rounded-lg border bg-surface px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Período rápido (desativado quando há intervalo de datas) */}
      <div className="flex rounded-lg border bg-surface p-0.5">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            onClick={() => update({ periodo: p.value, de: null, ate: null })}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              periodo === p.value && !rangeAtivo
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Intervalo de datas */}
      <div className="flex items-center gap-1 rounded-lg border bg-surface px-2 py-1">
        <span className="text-xs text-muted">De</span>
        <input
          type="date"
          value={de}
          max={ate || undefined}
          onChange={(e) => update({ de: e.target.value, ate })}
          className={dateCls}
        />
        <span className="text-xs text-muted">até</span>
        <input
          type="date"
          value={ate}
          min={de || undefined}
          onChange={(e) => update({ ate: e.target.value, de: de || e.target.value })}
          className={dateCls}
        />
        {rangeAtivo && (
          <button
            onClick={() => update({ de: null, ate: null })}
            className="ml-1 text-xs font-medium text-muted hover:text-foreground"
            title="Limpar intervalo"
          >
            ✕
          </button>
        )}
      </div>

      <select
        value={canal}
        onChange={(e) => update({ canal: e.target.value })}
        className={selectCls}
      >
        <option value="todos">Todos os canais</option>
        {channels.map((c) => (
          <option key={c} value={c}>
            {canalLabel(c)}
          </option>
        ))}
      </select>

      <select value={tag} onChange={(e) => update({ tag: e.target.value })} className={selectCls}>
        <option value="todas">Todas as tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {atendentes.length > 0 && (
        <select
          value={atendente}
          onChange={(e) => update({ atendente: e.target.value })}
          className={selectCls}
        >
          <option value="todos">Todos os atendentes</option>
          {atendentes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
