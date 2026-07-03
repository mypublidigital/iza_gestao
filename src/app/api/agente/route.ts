// Endpoint do agente conversacional (MOCK da fase local-first).
// Hoje: faz matching de intenção e computa respostas REAIS sobre o dataset mockado,
// simulando as ferramentas query_database e semantic_search.
// Depois: este handler chama a Anthropic API (claude-sonnet-4-6) com tool use real.

import { NextResponse } from "next/server";
import {
  getAssuntos,
  getCtwaPerformance,
  getDestinosRanking,
  getKpis,
  getNpsDist,
  loadConversations,
} from "@/lib/data";
import { num, pct } from "@/lib/format";
import { canRunRealAgent, runAgent, type ChatTurn } from "@/lib/agent";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";
import type { Conversation } from "@/lib/types";

export interface AgentToolCall {
  tool: "query_database" | "semantic_search";
  detail: string;
}
export interface AgentReply {
  answer: string;
  tools: AgentToolCall[];
  citations: string[];
}

function responder(pergunta: string, all: Conversation[]): AgentReply {
  const q = pergunta.toLowerCase();

  // NPS / satisfação
  if (/(nps|satisfa|promotor|detrator)/.test(q)) {
    const nps = getNpsDist(all);
    return {
      answer:
        `O NPS médio no período é **${num(nps.media, 1)}**, com ${nps.promotores} promotores, ` +
        `${nps.neutros} neutros e ${nps.detratores} detratores. ` +
        (nps.detratores > nps.promotores
          ? "A base está mais detratora — vale revisar as conversas negativas."
          : "Saldo positivo de promotores."),
      tools: [{ tool: "query_database", detail: "SELECT AVG(rating), faixas de NPS FROM nps_ratings" }],
      citations: all.filter((c) => c.nps && c.nps.rating <= 6).slice(0, 3).map((c) => c.conversationId),
    };
  }

  // Reclamações
  if (/(reclama|insatisf|problema|frustra)/.test(q)) {
    const recs = all.filter((c) => c.assunto === "Reclamação");
    return {
      answer:
        `Encontrei **${recs.length} conversas de reclamação**. Os temas recorrentes são hotel abaixo do esperado ` +
        `e demora na resolução. ${recs.filter((c) => c.resolvida !== "sim").length} seguem sem resolução plena.`,
      tools: [
        { tool: "semantic_search", detail: '"reclamações sobre atendimento e hotel"' },
        { tool: "query_database", detail: "WHERE assunto = 'Reclamação'" },
      ],
      citations: recs.slice(0, 4).map((c) => c.conversationId),
    };
  }

  // Destino específico ou ranking
  const destinos = getDestinosRanking(all);
  const destinoMatch = destinos.find((d) => q.includes(d.destino.toLowerCase().split("/")[0].split(" ")[0]));
  if (destinoMatch) {
    const cs = all.filter((c) => c.destinoPrincipal === destinoMatch.destino);
    return {
      answer:
        `Sobre **${destinoMatch.destino}**: ${destinoMatch.total} conversa(s) no período. ` +
        `Principais assuntos: ${[...new Set(cs.map((c) => c.assunto))].slice(0, 3).join(", ")}.`,
      tools: [{ tool: "query_database", detail: `WHERE destino_principal = '${destinoMatch.destino}'` }],
      citations: cs.slice(0, 4).map((c) => c.conversationId),
    };
  }
  if (/(destino|consultad|procurad|mais).*?(destino|viag)|destinos? mais/.test(q) || /destino/.test(q)) {
    const top = destinos.slice(0, 5);
    return {
      answer:
        "Os destinos mais consultados são: " +
        top.map((d, i) => `${i + 1}. **${d.destino}** (${d.total})`).join(", ") +
        ".",
      tools: [{ tool: "query_database", detail: "GROUP BY destino_principal ORDER BY COUNT(*) DESC" }],
      citations: [],
    };
  }

  // Horários
  if (/(horário|hora|pico|movimento|quando)/.test(q)) {
    return {
      answer:
        "O maior volume de conversas se concentra entre o fim da manhã e o início da noite, " +
        "com picos em dias úteis. Veja o heatmap completo no Dashboard.",
      tools: [{ tool: "query_database", detail: "GROUP BY dow(created_at), hour(created_at)" }],
      citations: [],
    };
  }

  // Anúncios / CTWA
  if (/(anúncio|anuncio|ctwa|campanha|marketing|roi)/.test(q)) {
    const ctwa = getCtwaPerformance(all);
    return {
      answer:
        "Por origem de anúncio (Click-to-WhatsApp): " +
        ctwa
          .slice(0, 3)
          .map((c) => `**${c.anuncio}** — ${c.conversas} conversas, NPS ${num(c.npsMedio, 1)}`)
          .join("; ") +
        ".",
      tools: [{ tool: "query_database", detail: "GROUP BY ctwa_headline" }],
      citations: [],
    };
  }

  // Não resolvidas
  if (/(não resolv|nao resolv|sem resolução|pendente|aberto)/.test(q)) {
    const nr = all.filter((c) => c.resolvida === "nao");
    return {
      answer: `Há **${nr.length} conversas sem resolução**. Concentram-se em reclamações e alterações de reserva.`,
      tools: [{ tool: "query_database", detail: "WHERE resolvida = 'nao'" }],
      citations: nr.slice(0, 4).map((c) => c.conversationId),
    };
  }

  // Fallback: panorama geral
  const kpis = getKpis(all);
  const assuntos = getAssuntos(all);
  return {
    answer:
      `No período há **${kpis.totalConversas} conversas**, taxa de resolução de ${pct(kpis.taxaResolucao)} ` +
      `e NPS médio ${num(kpis.npsMedio, 1)}. O assunto mais comum é "${assuntos[0]?.assunto}". ` +
      "Pergunte sobre destinos, reclamações, NPS, horários ou anúncios para detalhes.",
    tools: [{ tool: "query_database", detail: "panorama geral de conversations" }],
    citations: [],
  };
}

export async function POST(req: Request) {
  if (isAuthConfigured() && !(await getSessionUser())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { message, history } = (await req.json()) as {
    message: string;
    history?: ChatTurn[];
  };

  // Agente real (Claude Sonnet + tool use) quando configurado; senão, lógica local.
  if (canRunRealAgent()) {
    try {
      const reply = await runAgent(message ?? "", history ?? []);
      return NextResponse.json(reply);
    } catch (e) {
      console.error("[agente] agente real falhou, usando fallback:", e);
    }
  }

  const all = await loadConversations({});
  return NextResponse.json(responder(message ?? "", all));
}
