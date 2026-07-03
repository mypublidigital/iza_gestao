"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CANAL_LABEL } from "@/lib/format";

const PERIODOS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
];

export default function FilterBar({ tags }: { tags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const periodo = params.get("periodo") ?? "30";
  const canal = params.get("canal") ?? "todos";
  const tag = params.get("tag") ?? "todas";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "todos" || value === "todas") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const selectCls =
    "rounded-lg border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border bg-surface p-0.5">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            onClick={() => update("periodo", p.value)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              periodo === p.value
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <select value={canal} onChange={(e) => update("canal", e.target.value)} className={selectCls}>
        <option value="todos">Todos os canais</option>
        {Object.entries(CANAL_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>

      <select value={tag} onChange={(e) => update("tag", e.target.value)} className={selectCls}>
        <option value="todas">Todas as tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
