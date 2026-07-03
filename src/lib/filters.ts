import type { Canal, DashboardFilters } from "@/lib/types";

export interface RawParams {
  periodo?: string;
  canal?: string;
  tag?: string;
}

/** Converte os search params da URL em DashboardFilters (janela relativa à data atual). */
export function parseFilters(p: RawParams): DashboardFilters {
  const dias = Number(p.periodo ?? "30") || 30;
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - dias);
  return {
    from: from.toISOString(),
    to: now.toISOString(),
    channel: (p.canal as Canal) ?? "todos",
    tag: p.tag ?? "todas",
  };
}
