// Agente conversacional (Fase 5) — Claude Sonnet com tool use real.
// Ferramentas: query_database (text-to-SQL somente-leitura) e semantic_search (busca por texto
// nas mensagens). Combina as duas, cita conversationIds e responde em português.

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropic, AGENT_MODEL, ENRICH_MODEL } from "@/lib/anthropic";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface AgentToolCall {
  tool: "query_database" | "semantic_search";
  detail: string;
}
export interface AgentReply {
  answer: string;
  tools: AgentToolCall[];
  citations: string[];
}
export interface ChatTurn {
  role: "user" | "agent";
  text: string;
}

const SYSTEM = `Você é o assistente de inteligência da Iza Travel, uma agência de turismo brasileira.
Responda perguntas da equipe sobre as conversas que o agente de IA teve com clientes no WhatsApp.

Você tem duas ferramentas:
- query_database: executa UMA consulta SQL SOMENTE-LEITURA (SELECT) no Postgres para perguntas quantitativas/agregadas.
- semantic_search: busca mensagens por palavras-chave para perguntas qualitativas ("o que reclamam", "resuma dúvidas sobre X").

Esquema (Postgres):
- conversations(conversation_id text, channel text, status text, is_ai_enabled bool, user_name text,
    first_message_at timestamptz, last_message_at timestamptz, message_count int, frustration numeric,
    summary text, destino_principal text, destinos text[], assunto text, resolvida enum('sim','nao','parcial'),
    sentimento enum('positivo','neutro','negativo'), intencao_compra text, ctwa_headline text,
    atendentes text[])  -- nomes dos ATENDENTES HUMANOS (usuários do Chatvolt) que atenderam a conversa
- messages(conversation_id text, role enum('user','agent'), content text, created_at timestamptz)
- nps_ratings(conversation_id text, rating int, comment text, completed_at timestamptz)

Atendentes (humanos): a coluna conversations.atendentes é um text[] com os nomes de quem atendeu
(ex.: 'Paulinha', 'Juliana Parra'). Array vazio = conversa atendida só pela IA.
- Filtrar por atendente: WHERE 'Paulinha' = ANY(atendentes)  (compare nomes com ILIKE via EXISTS se necessário)
- Contar por atendente: SELECT unnest(atendentes) AS atendente, count(*) FROM conversations GROUP BY 1 ORDER BY 2 DESC

Datas e períodos (a coluna de referência é last_message_at; use timezone 'America/Sao_Paulo'):
- Últimos N dias: WHERE last_message_at >= now() - interval '7 days'
- Um mês específico: WHERE date_trunc('month', last_message_at AT TIME ZONE 'America/Sao_Paulo') = date '2026-06-01'
- Por mês: SELECT to_char(last_message_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes, count(*) ... GROUP BY 1 ORDER BY 1
- Exemplo combinado — atendimentos por atendente em julho/2026:
  SELECT unnest(atendentes) AS atendente, count(*) AS total FROM conversations
  WHERE last_message_at >= date '2026-07-01' AND last_message_at < date '2026-08-01'
  GROUP BY 1 ORDER BY 2 DESC;

Regras:
- Sempre inclua conversation_id quando fizer sentido, para poder citar as fontes.
- Use ILIKE para texto; sempre use LIMIT em SELECTs que possam retornar muitas linhas.
- Responda em português, de forma objetiva. Cite os conversation_id que embasam a resposta.
- Nunca invente dados: baseie-se apenas nos resultados das ferramentas.

Como pesquisar com eficiência (você tem poucas rodadas de ferramenta):
- Nomes de pessoas raramente batem exatamente. Use a lista de atendentes conhecidos abaixo e
  escolha o nome real mais próximo do que o usuário escreveu (ex.: "Danielly" → "Dany Amaral";
  "Ju" → "Juliana Parra"). Na dúvida, use ILIKE: EXISTS (SELECT 1 FROM unnest(atendentes) a WHERE a ILIKE '%dany%').
- NUNCA repita uma consulta que já retornou vazio ou deu erro: mude a abordagem (outro nome, outro filtro,
  ou uma consulta exploratória como SELECT DISTINCT unnest(atendentes) FROM conversations).
- Perguntas compostas: resolva uma parte por vez e, para a parte qualitativa, prefira buscar a
  coluna summary das conversas relevantes em UMA consulta SQL em vez de várias buscas semânticas.
- Se ainda faltar informação, responda com o que já descobriu e diga claramente o que não foi possível apurar.
  Nunca termine sem responder.

Formato da resposta (Markdown — a interface renderiza títulos, listas, tabelas e negrito):
- NUNCA responda em um bloco único de texto corrido.
- Comece com 1 frase direta respondendo à pergunta. Não escreva preâmbulos sobre o seu processo
  ("Ótimo!", "Deixa eu analisar...", "Vou consultar..."): entregue direto o resultado.
- Use listas com marcadores para itens e **tabelas Markdown** para comparações e rankings (ex.: atendente × total).
- Use **negrito** para números e nomes importantes; use títulos curtos (###) apenas quando a resposta tiver seções.
- Feche com "Fontes:" citando os conversation_id relevantes (quando houver).`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "query_database",
    description:
      "Executa uma consulta SQL SELECT (somente leitura) no Postgres e retorna as linhas em JSON. Use para números, contagens, médias, rankings e filtros.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        sql: { type: "string", description: "A consulta SQL (apenas SELECT/WITH)." },
      },
      required: ["sql"],
    },
  },
  {
    name: "semantic_search",
    description:
      "Busca trechos de mensagens por palavras-chave. Use para perguntas qualitativas sobre o conteúdo das conversas.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Palavras-chave ou tema a buscar." },
        limit: { type: "integer", description: "Máximo de trechos (padrão 8)." },
      },
      required: ["query"],
    },
  },
];

function extractIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const ids: string[] = [];
  for (const r of rows) {
    const id = (r as Record<string, unknown>)?.conversation_id;
    if (typeof id === "string") ids.push(id);
  }
  return ids;
}

async function runQueryDatabase(
  sb: SupabaseClient,
  sql: string,
): Promise<{ content: string; ids: string[] }> {
  const lowered = sql.trim().toLowerCase();
  if (!lowered.startsWith("select") && !lowered.startsWith("with")) {
    return { content: "Erro: apenas consultas SELECT são permitidas.", ids: [] };
  }
  const { data, error } = await sb.rpc("agent_query", { query_text: sql });
  if (error) return { content: `Erro ao executar SQL: ${error.message}`, ids: [] };
  const rows = data ?? [];
  return { content: JSON.stringify(rows).slice(0, 8000), ids: extractIds(rows) };
}

async function runSemanticSearch(
  sb: SupabaseClient,
  query: string,
  limit = 8,
): Promise<{ content: string; ids: string[] }> {
  // Fase 5 (sem embeddings): busca por palavras-chave (ILIKE). Upgradeável a pgvector com Voyage.
  const terms = query
    .toLowerCase()
    .split(/[^a-zà-ú0-9]+/i)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .map((w) => w.replace(/[%,()]/g, ""));
  let qb = sb.from("messages").select("conversation_id,content,created_at").limit(limit * 4);
  if (terms.length) qb = qb.or(terms.map((t) => `content.ilike.%${t}%`).join(","));
  const { data, error } = await qb;
  if (error) return { content: `Erro na busca: ${error.message}`, ids: [] };

  const seen = new Set<string>();
  const results: { conversation_id: string; trecho: string }[] = [];
  for (const m of data ?? []) {
    if (seen.has(m.conversation_id)) continue;
    seen.add(m.conversation_id);
    results.push({ conversation_id: m.conversation_id, trecho: (m.content as string).slice(0, 200) });
    if (results.length >= limit) break;
  }
  return { content: JSON.stringify(results), ids: results.map((r) => r.conversation_id) };
}

/** true quando o agente real pode rodar (Claude + Supabase configurados). */
export function canRunRealAgent(): boolean {
  return Boolean(getAnthropic() && getSupabaseAdmin());
}

/** Contexto dinâmico: data de hoje (São Paulo) e nomes reais dos atendentes.
 *  Evita que o agente erre o ano em perguntas por mês e que procure nomes inexistentes. */
async function buildSystem(sb: SupabaseClient, learnings: string[] = []): Promise<string> {
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
  }).format(new Date());
  const iso = new Date().toISOString().slice(0, 10);

  let atendentes: string[] = [];
  try {
    const { data } = await sb.from("conversations").select("atendentes").limit(2000);
    atendentes = [...new Set((data ?? []).flatMap((r) => r.atendentes ?? []))].filter(Boolean);
  } catch {
    // segue sem a lista
  }

  return (
    `${SYSTEM}\n\n` +
    `Contexto atual:\n` +
    `- Hoje é ${hoje} (data ISO: ${iso}, fuso America/Sao_Paulo). Use isto para interpretar ` +
    `"este mês", "julho", "últimos 30 dias" etc.\n` +
    (atendentes.length
      ? `- Atendentes humanos existentes (nomes EXATOS como estão no banco): ${atendentes.join(", ")}.\n`
      : `- Ainda não há atendentes registrados nas conversas.\n`) +
    (learnings.length
      ? `\nAprendizados de conversas anteriores com a equipe (use como contexto; se algo contradisser ` +
        `os dados atuais, confie nos dados):\n${learnings.map((l) => `- ${l}`).join("\n")}\n`
      : "")
  );
}

/** Extrai 0–3 aprendizados duráveis da interação, para reaproveitar em conversas futuras. */
export async function extractLearnings(pergunta: string, resposta: string): Promise<string[]> {
  const anthropic = getAnthropic();
  if (!anthropic) return [];
  try {
    const msg = await anthropic.messages.create({
      model: ENRICH_MODEL,
      max_tokens: 400,
      system:
        "Você observa conversas entre a equipe da Iza Travel e um assistente de dados. " +
        "Extraia apenas APRENDIZADOS DURÁVEIS e reutilizáveis: preferências da equipe, apelidos/nomes " +
        "(ex.: 'a equipe chama Dany Amaral de Danielly'), definições de negócio, métricas que costumam pedir, " +
        "ou fatos estáveis sobre a operação. NÃO extraia números pontuais nem fatos que mudam a cada dia " +
        "(ex.: 'houve 35 conversas em julho'). Se não houver nada durável, devolva lista vazia.",
      tools: [
        {
          name: "registrar_aprendizados",
          description: "Registra aprendizados duráveis da interação.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              aprendizados: {
                type: "array",
                items: { type: "string" },
                description: "0 a 3 frases curtas em português, autoexplicativas fora do contexto.",
              },
            },
            required: ["aprendizados"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "registrar_aprendizados" },
      messages: [
        { role: "user", content: `Pergunta da equipe:\n${pergunta}\n\nResposta do assistente:\n${resposta.slice(0, 4000)}` },
      ],
    });
    const block = msg.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return [];
    const out = (block.input as { aprendizados?: unknown }).aprendizados;
    return Array.isArray(out) ? out.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function runAgent(
  message: string,
  history: ChatTurn[] = [],
  learnings: string[] = [],
): Promise<AgentReply> {
  const anthropic = getAnthropic();
  const sb = getSupabaseAdmin();
  if (!anthropic || !sb) throw new Error("agente real não configurado");

  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({
      role: (t.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: t.text,
    })),
    { role: "user", content: message },
  ];

  const toolsUsed: AgentToolCall[] = [];
  const citations = new Set<string>();
  const system = await buildSystem(sb, learnings);
  const MAX_ROUNDS = 12;

  for (let i = 0; i < MAX_ROUNDS; i++) {
    const resp = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 2000,
      system,
      tools: TOOLS,
      messages,
    });
    messages.push({ role: "assistant", content: resp.content });

    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      const answer = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { answer: answer || "Não consegui elaborar uma resposta.", tools: toolsUsed, citations: [...citations].slice(0, 6) };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu.type !== "tool_use") continue;
      const input = tu.input as Record<string, unknown>;
      let out: { content: string; ids: string[] };
      if (tu.name === "query_database") {
        const sql = String(input.sql ?? "");
        toolsUsed.push({ tool: "query_database", detail: sql.slice(0, 300) });
        out = await runQueryDatabase(sb, sql);
      } else {
        const q = String(input.query ?? "");
        toolsUsed.push({ tool: "semantic_search", detail: `"${q}"` });
        out = await runSemanticSearch(sb, q, Number(input.limit) || 8);
      }
      out.ids.forEach((id) => citations.add(id));
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: out.content });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Estourou as rodadas de pesquisa: em vez de descartar tudo, pede a resposta final
  // SEM ferramentas, usando o que já foi coletado.
  messages.push({
    role: "user",
    content:
      "Pare de pesquisar e responda agora com base no que você já coletou nesta conversa. " +
      "Se algum dado não foi possível apurar, diga isso explicitamente — mas entregue tudo o que descobriu.",
  });
  const final = await anthropic.messages.create({
    model: AGENT_MODEL,
    max_tokens: 2000,
    system,
    messages,
  });
  const answer = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    answer:
      answer ||
      "Não consegui concluir a pesquisa. Tente reformular a pergunta de forma mais específica.",
    tools: toolsUsed,
    citations: [...citations].slice(0, 6),
  };
}
