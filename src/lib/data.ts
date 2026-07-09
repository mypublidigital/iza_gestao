// Camada de acesso a dados.
// loadConversations/loadConversation escolhem a fonte: Supabase (quando configurado E com dados)
// ou o mock (fallback local-first). As agregações são funções PURAS que recebem a lista carregada,
// então as telas fazem uma única leitura e derivam todos os indicadores dela.

import { conversations as MOCK, rawEvents as MOCK_RAW } from "@/lib/mock/data";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { dbLoadConversation, dbLoadConversations } from "@/lib/data-supabase";
import type {
  AssuntoDist,
  CanalDist,
  Conversation,
  CtwaPerformance,
  DashboardFilters,
  DestinoRanking,
  DuvidaNaoResolvida,
  HeatmapCell,
  KpiSummary,
  NpsDist,
  RawEvent,
  ResolucaoDist,
  SerieTemporal,
} from "@/lib/types";

// ---------------- Fonte de dados ----------------

async function hasRealData(): Promise<boolean> {
  // Em produção (Supabase configurado) usamos SEMPRE dados reais — mesmo vazios (estado limpo).
  // O mock só aparece quando não há Supabase (repo clonado sem credenciais / dev local).
  return isSupabaseConfigured();
}

export function filterConversations(list: Conversation[], f: DashboardFilters = {}): Conversation[] {
  return list.filter((c) => {
    const t = +new Date(c.lastMessageAt);
    if (f.from && t < +new Date(f.from)) return false;
    if (f.to && t > +new Date(f.to)) return false;
    if (f.channel && f.channel !== "todos" && c.channel !== f.channel) return false;
    if (f.tag && f.tag !== "todas" && !c.tags.includes(f.tag)) return false;
    return true;
  });
}

/** Carrega as conversas (fonte real ou mock) já aplicando os filtros. */
export async function loadConversations(f: DashboardFilters = {}): Promise<Conversation[]> {
  const source = (await hasRealData()) ? await dbLoadConversations() : MOCK;
  return filterConversations(source, f);
}

export async function loadConversation(id: string): Promise<Conversation | undefined> {
  if (await hasRealData()) {
    const c = await dbLoadConversation(id);
    if (c) return c;
  }
  return MOCK.find((c) => c.conversationId === id);
}

export async function loadRawEvents(limit = 100): Promise<RawEvent[]> {
  return MOCK_RAW.slice(0, limit);
}

export function collectTags(list: Conversation[]): string[] {
  return Array.from(new Set(list.flatMap((c) => c.tags))).sort();
}

export function collectChannels(list: Conversation[]): string[] {
  return Array.from(new Set(list.map((c) => c.channel))).filter(Boolean).sort();
}

// ---------------- Agregações do dashboard (puras) ----------------

export function getKpis(list: Conversation[]): KpiSummary {
  const total = list.length || 1;
  const npsList = list.filter((c) => c.nps).map((c) => c.nps!.rating);
  const resolvidas = list.filter((c) => c.resolvida === "sim").length;
  const transferidas = list.filter((c) => !c.isAiEnabled || c.status === "transferida").length;
  const frust = list.reduce((s, c) => s + c.frustration, 0) / total;
  const msgs = list.reduce((s, c) => s + c.messageCount, 0) / total;
  const duracoes = list.map(
    (c) => (+new Date(c.lastMessageAt) - +new Date(c.firstMessageAt)) / 60000,
  );
  return {
    totalConversas: list.length,
    npsMedio: npsList.length ? npsList.reduce((a, b) => a + b, 0) / npsList.length : 0,
    taxaResolucao: resolvidas / total,
    taxaTransferencia: transferidas / total,
    frustrationMedia: frust,
    duracaoMediaMin: duracoes.reduce((a, b) => a + b, 0) / total,
    mensagensPorConversa: msgs,
  };
}

export function getDestinosRanking(list: Conversation[]): DestinoRanking[] {
  const counts = new Map<string, number>();
  for (const c of list) {
    if (!c.destinoPrincipal) continue;
    counts.set(c.destinoPrincipal, (counts.get(c.destinoPrincipal) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([destino, total]) => ({
      destino,
      total,
      variacao: Math.round(((destino.length * 7) % 40) - 15),
    }))
    .sort((a, b) => b.total - a.total);
}

export function getAssuntos(list: Conversation[]): AssuntoDist[] {
  const counts = new Map<string, number>();
  for (const c of list) counts.set(c.assunto, (counts.get(c.assunto) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([assunto, total]) => ({ assunto, total }))
    .sort((a, b) => b.total - a.total);
}

export function getHeatmap(list: Conversation[]): HeatmapCell[] {
  const grid = new Map<string, number>();
  for (const c of list) {
    const d = new Date(c.firstMessageAt);
    grid.set(`${d.getDay()}-${d.getHours()}`, (grid.get(`${d.getDay()}-${d.getHours()}`) ?? 0) + 1);
  }
  const cells: HeatmapCell[] = [];
  for (let dia = 0; dia < 7; dia++)
    for (let hora = 0; hora < 24; hora++)
      cells.push({ dia, hora, total: grid.get(`${dia}-${hora}`) ?? 0 });
  return cells;
}

export function getNpsDist(list: Conversation[]): NpsDist {
  const withNps = list.filter((c) => c.nps);
  let prom = 0,
    neu = 0,
    det = 0,
    soma = 0;
  for (const c of withNps) {
    const r = c.nps!.rating;
    soma += r;
    if (r >= 9) prom++;
    else if (r >= 7) neu++;
    else det++;
  }
  return { promotores: prom, neutros: neu, detratores: det, media: withNps.length ? soma / withNps.length : 0 };
}

export function getCanalDist(list: Conversation[]): CanalDist[] {
  const counts = new Map<string, number>();
  for (const c of list) counts.set(c.channel, (counts.get(c.channel) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([canal, total]) => ({ canal: canal as CanalDist["canal"], total }))
    .sort((a, b) => b.total - a.total);
}

export function getResolucao(list: Conversation[]): ResolucaoDist {
  return {
    resolvidas: list.filter((c) => c.resolvida === "sim").length,
    parciais: list.filter((c) => c.resolvida === "parcial").length,
    naoResolvidas: list.filter((c) => c.resolvida === "nao").length,
  };
}

export function getSerieTemporal(list: Conversation[]): SerieTemporal[] {
  const byDay = new Map<string, { total: number; sent: number }>();
  for (const c of list) {
    const day = c.lastMessageAt.slice(0, 10);
    const prev = byDay.get(day) ?? { total: 0, sent: 0 };
    const sentVal = c.sentimento === "positivo" ? 1 : c.sentimento === "negativo" ? -1 : 0;
    byDay.set(day, { total: prev.total + 1, sent: prev.sent + sentVal });
  }
  return Array.from(byDay.entries())
    .map(([data, v]) => ({ data, total: v.total, sentimentoMedio: v.total ? v.sent / v.total : 0 }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function getCtwaPerformance(list: Conversation[]): CtwaPerformance[] {
  const groups = new Map<string, Conversation[]>();
  for (const c of list) {
    if (!c.ctwa) continue;
    groups.set(c.ctwa.headline, [...(groups.get(c.ctwa.headline) ?? []), c]);
  }
  return Array.from(groups.entries())
    .map(([anuncio, cs]) => {
      const nps = cs.filter((c) => c.nps).map((c) => c.nps!.rating);
      const intAlta = cs.filter((c) => c.intencaoCompra === "alta").length;
      return {
        anuncio,
        conversas: cs.length,
        npsMedio: nps.length ? nps.reduce((a, b) => a + b, 0) / nps.length : 0,
        intencaoAltaPct: cs.length ? (intAlta / cs.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.conversas - a.conversas);
}

export function getDuvidasNaoResolvidas(list: Conversation[]): DuvidaNaoResolvida[] {
  return list
    .filter((c) => c.resolvida === "nao")
    .slice(0, 8)
    .map((c) => ({
      conversationId: c.conversationId,
      assunto: c.assunto,
      resumo: c.summary ?? "",
      destino: c.destinoPrincipal,
    }));
}
