import type { Canal, DashboardFilters } from "@/lib/types";

export interface RawParams {
  periodo?: string;
  canal?: string;
  tag?: string;
  de?: string; // YYYY-MM-DD (data inicial)
  ate?: string; // YYYY-MM-DD (data final)
  atendente?: string;
}

/** Converte os search params da URL em DashboardFilters.
 *  Se houver intervalo explícito (de/até), ele tem prioridade sobre o período (7/30/60). */
export function parseFilters(p: RawParams): DashboardFilters {
  const now = new Date();
  let from: string;
  let to = now.toISOString();

  if (p.de) {
    from = new Date(`${p.de}T00:00:00`).toISOString();
    if (p.ate) to = new Date(`${p.ate}T23:59:59`).toISOString();
  } else {
    const dias = Number(p.periodo ?? "30") || 30;
    const f = new Date(now);
    f.setDate(f.getDate() - dias);
    from = f.toISOString();
  }

  return {
    from,
    to,
    channel: (p.canal as Canal) ?? "todos",
    tag: p.tag ?? "todas",
    atendente: p.atendente ?? "todos",
  };
}
