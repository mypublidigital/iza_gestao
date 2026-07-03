import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import EventSimulator from "@/components/EventSimulator";
import ProcessButton from "@/components/ProcessButton";
import SeedButton from "@/components/SeedButton";
import { getRecentIngested } from "@/lib/ingest-store";
import { loadRawEvents } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  dbCountUnprocessed,
  dbLoadConversationsPreview,
  dbLoadRawEvents,
  type ConversationPreview,
} from "@/lib/data-supabase";
import { CANAL_LABEL, dataHora } from "@/lib/format";
import type { Canal, RawEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EventosPage() {
  const online = isSupabaseConfigured();

  // Com Supabase: dados reais do banco. Sem: modo local-first (memória + mock).
  const eventos = online
    ? await dbLoadRawEvents(40)
    : [...getRecentIngested(20), ...(await loadRawEvents(30))];
  const pendentes = online ? await dbCountUnprocessed() : 0;
  const conversas = online ? await dbLoadConversationsPreview(20) : [];

  return (
    <>
      <PageHeader
        title="Integração & Testes"
        subtitle="Área técnica (admin) — acompanha os dados que chegam do Chatvolt"
      />

      <div className="space-y-6 p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">O que é esta página?</p>
          <p className="mt-1.5 leading-relaxed">
            Cada vez que um cliente fala com a IA no WhatsApp, o <strong>Chatvolt</strong> envia
            automaticamente para esta plataforma uma <strong>ficha de dados</strong> da conversa (o
            chamado <em>payload</em>). Ela é guardada e depois <strong>processada</strong> — virando
            as conversas e mensagens que alimentam o Dashboard.
          </p>
          <p className="mt-1.5 leading-relaxed">
            {online ? (
              <>
                <strong>Conectado ao Supabase.</strong> As fichas abaixo são reais, gravadas no seu
                banco. Use o <strong>Simulador</strong> para enviar uma ficha de teste e o botão{" "}
                <strong>Processar agora</strong> para transformá-la em conversa (em produção, o Vercel
                Cron faz isso sozinho a cada minuto).
              </>
            ) : (
              <>
                <strong>Modo local (sem banco).</strong> As fichas abaixo são simuladas. Configure o
                Supabase no <code>.env.local</code> para gravar de verdade.
              </>
            )}
          </p>
        </div>

        <Card
          title="Simulador — enviar uma ficha de teste"
          hint="finge ser o Chatvolt enquanto a integração não está pronta"
        >
          <EventSimulator />
        </Card>

        {online && (
          <Card
            title="Dados de exemplo"
            hint="popula o banco para validar o Dashboard"
          >
            <p className="mb-3 text-sm text-muted">
              Gera ~15 conversas realistas, processa e classifica com a IA — o Dashboard e as
              Conversas passam a exibir dados reais. Pode rodar mais de uma vez.
            </p>
            <SeedButton />
          </Card>
        )}

        {online && (
          <Card
            title="Processamento"
            hint="transforma raw_events em conversas/mensagens"
          >
            <ProcessButton pending={pendentes} />
          </Card>
        )}

        {online && (
          <Card
            title="Conversas processadas"
            hint={`${conversas.length} conversa(s) no banco`}
          >
            {conversas.length > 0 ? (
              <ConversationPreviewTable rows={conversas} />
            ) : (
              <p className="py-4 text-center text-sm text-muted">
                Nenhuma conversa ainda. Envie uma ficha no simulador e clique em “Processar agora”.
              </p>
            )}
          </Card>
        )}

        <Card
          title={online ? "Fichas recebidas (raw_events)" : "Histórico de fichas (simulado)"}
          hint="append-only · fonte da verdade"
        >
          <EventTable events={eventos} />
        </Card>
      </div>
    </>
  );
}

function ConversationPreviewTable({ rows }: { rows: ConversationPreview[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="pb-2 font-medium">Cliente</th>
            <th className="pb-2 font-medium">Canal</th>
            <th className="pb-2 font-medium">Mensagens</th>
            <th className="pb-2 font-medium">Resumo</th>
            <th className="pb-2 font-medium">Última msg</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => (
            <tr key={c.conversationId} className="hover:bg-surface-2">
              <td className="py-2 pr-3">
                <Link href={`/conversas/${c.conversationId}`} className="font-medium text-primary hover:underline">
                  {c.userName ?? c.conversationId}
                </Link>
              </td>
              <td className="py-2 pr-3 text-muted">
                {c.channel ? CANAL_LABEL[c.channel as Canal] ?? c.channel : "—"}
              </td>
              <td className="py-2 pr-3 tabular-nums">{c.messageCount}</td>
              <td className="py-2 pr-3 text-xs text-muted">{c.summary ?? "—"}</td>
              <td className="py-2 text-xs text-muted">
                {c.lastMessageAt ? dataHora(c.lastMessageAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventTable({ events }: { events: RawEvent[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="pb-2 font-medium">Recebida em</th>
            <th className="pb-2 font-medium">Tipo de evento</th>
            <th className="pb-2 font-medium">Conversa</th>
            <th className="pb-2 font-medium">Autenticação</th>
            <th className="pb-2 font-medium">Processada</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {events.map((e) => (
            <tr key={e.id}>
              <td className="py-2 pr-3 text-xs text-muted">{dataHora(e.receivedAt)}</td>
              <td className="py-2 pr-3">
                <code className="text-xs">{e.eventType}</code>
              </td>
              <td className="py-2 pr-3 text-xs text-muted">{e.conversationId}</td>
              <td className="py-2 pr-3">
                <Badge tone={e.authValid ? "positivo" : "negativo"}>
                  {e.authValid ? "válido" : "inválido"}
                </Badge>
              </td>
              <td className="py-2">
                <Badge tone={e.processed ? "positivo" : "neutro"}>
                  {e.processed ? "sim" : "pendente"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
