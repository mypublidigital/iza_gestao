import Link from "next/link";
import { Badge, PageHeader } from "@/components/ui";
import FilterBar from "@/components/FilterBar";
import SearchInput from "@/components/SearchInput";
import { collectTags, filterConversations, loadConversations } from "@/lib/data";
import { parseFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";
import { CANAL_LABEL, SENTIMENTO_LABEL, dataHora } from "@/lib/format";
import type { ConversationStatus, Sentimento } from "@/lib/types";

const STATUS_TONE: Record<ConversationStatus, "primary" | "positivo" | "neutro" | "accent"> = {
  aberta: "primary",
  resolvida: "positivo",
  pendente: "neutro",
  transferida: "accent",
};
const SENT_TONE: Record<Sentimento, "positivo" | "neutro" | "negativo"> = {
  positivo: "positivo",
  neutro: "neutro",
  negativo: "negativo",
};

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; canal?: string; tag?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const q = (sp.q ?? "").toLowerCase().trim();

  const all = await loadConversations({});
  let list = filterConversations(all, f);
  if (q) {
    list = list.filter(
      (c) =>
        c.userName?.toLowerCase().includes(q) ||
        c.summary?.toLowerCase().includes(q) ||
        c.assunto.toLowerCase().includes(q) ||
        c.destinoPrincipal?.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }

  return (
    <>
      <PageHeader
        title="Conversas"
        subtitle={`${list.length} conversa(s) no período e filtros selecionados`}
        actions={<SearchInput placeholder="Buscar por nome, destino, texto..." />}
      />

      <div className="space-y-4 p-8">
        <FilterBar tags={collectTags(all)} />

        <div className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Assunto / Destino</th>
                <th className="px-4 py-3 font-medium">Canal</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sentimento</th>
                <th className="px-4 py-3 font-medium">Última msg</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((c) => (
                <tr key={c.conversationId} className="group hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/conversas/${c.conversationId}`} className="block">
                      <span className="font-medium text-foreground group-hover:text-primary">
                        {c.userName}
                      </span>
                      <span className="block text-xs text-muted">{c.messageCount} mensagens</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-foreground">{c.assunto}</span>
                    <span className="block text-xs text-muted">{c.destinoPrincipal}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{CANAL_LABEL[c.channel]}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={SENT_TONE[c.sentimento]}>{SENTIMENTO_LABEL[c.sentimento]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{dataHora(c.lastMessageAt)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    Nenhuma conversa encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
