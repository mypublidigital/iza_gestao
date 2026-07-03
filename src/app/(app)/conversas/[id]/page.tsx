import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { loadConversation } from "@/lib/data";
import {
  CANAL_LABEL,
  SENTIMENTO_LABEL,
  dataHora,
  num,
  pct,
} from "@/lib/format";

export default async function ConversaDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await loadConversation(id);
  if (!c) notFound();

  return (
    <>
      <div className="flex items-center gap-3 border-b bg-surface px-8 py-5">
        <Link
          href="/conversas"
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted hover:bg-surface-2"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{c.userName}</h1>
          <p className="text-xs text-muted">
            {CANAL_LABEL[c.channel]} · {c.conversationId}
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-8 lg:grid-cols-[1fr_320px]">
        {/* Timeline */}
        <Card title="Histórico da conversa">
          <div className="space-y-3">
            {c.messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "rounded-tl-sm bg-surface-2 text-foreground"
                      : "rounded-tr-sm bg-primary text-white"
                  }`}
                >
                  <p>{m.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      m.role === "user" ? "text-muted" : "text-white/70"
                    }`}
                  >
                    {m.role === "user" ? "Cliente" : c.agentName} · {dataHora(m.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Metadados */}
        <div className="space-y-4">
          <Card title="Classificação (IA)">
            <dl className="space-y-3 text-sm">
              <Row label="Assunto">{c.assunto}</Row>
              <Row label="Destino">{c.destinoPrincipal ?? "—"}</Row>
              <Row label="Resolutividade">
                <Badge
                  tone={c.resolvida === "sim" ? "positivo" : c.resolvida === "parcial" ? "neutro" : "negativo"}
                >
                  {c.resolvida}
                </Badge>
              </Row>
              <Row label="Sentimento">
                <Badge
                  tone={c.sentimento === "positivo" ? "positivo" : c.sentimento === "negativo" ? "negativo" : "neutro"}
                >
                  {SENTIMENTO_LABEL[c.sentimento]}
                </Badge>
              </Row>
              <Row label="Intenção de compra">{c.intencaoCompra}</Row>
              <Row label="Frustração">{pct(c.frustration)}</Row>
            </dl>
            {c.summary && (
              <p className="mt-4 rounded-lg bg-surface-2 p-3 text-xs text-muted">{c.summary}</p>
            )}
          </Card>

          <Card title="Atendimento">
            <dl className="space-y-3 text-sm">
              <Row label="Status">{c.status}</Row>
              <Row label="Prioridade">{c.priority}</Row>
              <Row label="IA ativa">{c.isAiEnabled ? "Sim" : "Não (humano)"}</Row>
              <Row label="Mensagens">{num(c.messageCount)}</Row>
              <Row label="Início">{dataHora(c.firstMessageAt)}</Row>
            </dl>
            {c.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <Badge key={t} tone="slate">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          {c.nps && (
            <Card title="NPS">
              <p className="text-3xl font-semibold text-foreground">{c.nps.rating}/10</p>
              {c.nps.comment && <p className="mt-2 text-sm text-muted">“{c.nps.comment}”</p>}
            </Card>
          )}

          {c.ctwa && (
            <Card title="Origem (anúncio CTWA)">
              <p className="text-sm font-medium text-foreground">{c.ctwa.headline}</p>
              {c.ctwa.body && <p className="mt-1 text-xs text-muted">{c.ctwa.body}</p>}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}
