import { DIAS_SEMANA } from "@/lib/format";
import type { HeatmapCell } from "@/lib/types";

export default function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const max = Math.max(1, ...cells.map((c) => c.total));
  const get = (dia: number, hora: number) =>
    cells.find((c) => c.dia === dia && c.hora === hora)?.total ?? 0;

  const cor = (total: number) => {
    if (total === 0) return "var(--surface-2)";
    const t = 0.18 + (total / max) * 0.82;
    return `color-mix(in srgb, var(--primary) ${Math.round(t * 100)}%, white)`;
  };

  const horas = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="flex pl-10">
          {horas.map((h) => (
            <div key={h} className="flex-1 text-center text-[10px] text-muted">
              {h % 3 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>
        {DIAS_SEMANA.map((dia, di) => (
          <div key={dia} className="flex items-center">
            <div className="w-10 text-right pr-2 text-[11px] font-medium text-muted">{dia}</div>
            <div className="flex flex-1 gap-0.5 py-0.5">
              {horas.map((h) => {
                const total = get(di, h);
                return (
                  <div
                    key={h}
                    title={`${dia} ${h}h — ${total} conversa(s)`}
                    className="aspect-square flex-1 rounded-[3px]"
                    style={{ background: cor(total) }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
