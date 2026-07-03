import Link from "next/link";
import { Badge, Card, KpiCard, PageHeader } from "@/components/ui";
import FilterBar from "@/components/FilterBar";
import Heatmap from "@/components/Heatmap";
import {
  AssuntosBar,
  CanalDonut,
  DestinosBar,
  NpsBar,
  ResolucaoDonut,
  SentimentoLine,
  VolumeLine,
} from "@/components/charts";
import {
  collectTags,
  filterConversations,
  getAssuntos,
  getCanalDist,
  getCtwaPerformance,
  getDestinosRanking,
  getDuvidasNaoResolvidas,
  getHeatmap,
  getKpis,
  getNpsDist,
  getResolucao,
  getSerieTemporal,
  loadConversations,
} from "@/lib/data";
import { parseFilters } from "@/lib/filters";
import { num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; canal?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp);

  const all = await loadConversations({});
  const list = filterConversations(all, f);

  const kpis = getKpis(list);
  const destinos = getDestinosRanking(list);
  const assuntos = getAssuntos(list);
  const heatmap = getHeatmap(list);
  const nps = getNpsDist(list);
  const canais = getCanalDist(list);
  const resolucao = getResolucao(list);
  const serie = getSerieTemporal(list);
  const ctwa = getCtwaPerformance(list);
  const duvidas = getDuvidasNaoResolvidas(list);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Indicadores de atendimento do agente de IA no WhatsApp"
        actions={<FilterBar tags={collectTags(all)} />}
      />

      <div className="space-y-6 p-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Conversas no período" value={num(kpis.totalConversas)} accent />
          <KpiCard label="NPS médio" value={num(kpis.npsMedio, 1)} />
          <KpiCard label="Taxa de resolução" value={pct(kpis.taxaResolucao)} />
          <KpiCard label="Transferência p/ humano" value={pct(kpis.taxaTransferencia)} />
          <KpiCard label="Frustração média" value={pct(kpis.frustrationMedia)} />
          <KpiCard label="Duração média" value={`${num(kpis.duracaoMediaMin)} min`} />
          <KpiCard label="Msgs por conversa" value={num(kpis.mensagensPorConversa, 1)} />
          <KpiCard
            label="Promotores"
            value={`${nps.promotores}`}
            delta={{ value: `${nps.detratores} detratores`, positive: nps.promotores >= nps.detratores }}
          />
        </div>

        {/* Volume + sentimento */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Volume de conversas ao longo do tempo">
            <VolumeLine data={serie} />
          </Card>
          <Card title="Sentimento ao longo do tempo" hint="-1 negativo · +1 positivo">
            <SentimentoLine data={serie} />
          </Card>
        </div>

        {/* Destinos + Assuntos */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Destinos mais consultados" hint="ranking + tendência">
            <DestinosBar data={destinos.slice(0, 8)} />
          </Card>
          <Card title="Tipos de assunto tratado">
            <AssuntosBar data={assuntos} />
          </Card>
        </div>

        {/* Heatmap */}
        <Card title="Principais horários de atendimento" hint="dia da semana × hora">
          <Heatmap cells={heatmap} />
        </Card>

        {/* Satisfação + resolução + canal */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Índice de satisfação (NPS)" hint={`média ${num(nps.media, 1)}`}>
            <NpsBar data={nps} />
          </Card>
          <Card title="Resolutividade">
            <ResolucaoDonut data={resolucao} />
          </Card>
          <Card title="Distribuição por canal">
            <CanalDonut data={canais} />
          </Card>
        </div>

        {/* CTWA + dúvidas não resolvidas */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="ROI de anúncios (Click-to-WhatsApp)" hint="origem → atendimento">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 font-medium">Anúncio</th>
                    <th className="pb-2 text-right font-medium">Conversas</th>
                    <th className="pb-2 text-right font-medium">NPS</th>
                    <th className="pb-2 text-right font-medium">Intenção alta</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ctwa.map((c) => (
                    <tr key={c.anuncio}>
                      <td className="py-2 pr-2">{c.anuncio}</td>
                      <td className="py-2 text-right tabular-nums">{c.conversas}</td>
                      <td className="py-2 text-right tabular-nums">{num(c.npsMedio, 1)}</td>
                      <td className="py-2 text-right tabular-nums">{pct(c.intencaoAltaPct / 100)}</td>
                    </tr>
                  ))}
                  {ctwa.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted">
                        Sem conversas originadas de anúncios no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Top dúvidas não resolvidas"
            hint="alimentam a base do agente Chatvolt"
          >
            <ul className="divide-y">
              {duvidas.map((d) => (
                <li key={d.conversationId} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm text-foreground">{d.resumo}</p>
                    <div className="mt-1 flex gap-2">
                      <Badge tone="accent">{d.assunto}</Badge>
                      {d.destino && <Badge tone="primary">{d.destino}</Badge>}
                    </div>
                  </div>
                  <Link
                    href={`/conversas/${d.conversationId}`}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    ver →
                  </Link>
                </li>
              ))}
              {duvidas.length === 0 && (
                <li className="py-4 text-center text-muted">Nenhuma dúvida em aberto. 🎉</li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
