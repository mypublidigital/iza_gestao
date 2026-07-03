// Agente conversacional (Fase 5) — Claude Sonnet com tool use real.
// Ferramentas: query_database (text-to-SQL somente-leitura) e semantic_search (busca por texto
// nas mensagens). Combina as duas, cita conversationIds e responde em português.

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropic, AGENT_MODEL } from "@/lib/anthropic";
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

const SYSTEM = `Você é o assistente de inteligência da ISA Travel, uma agência de turismo brasileira.
Responda perguntas da equipe sobre as conversas que o agente de IA teve com clientes no WhatsApp.

Você tem duas ferramentas:
- query_database: executa UMA consulta SQL SOMENTE-LEITURA (SELECT) no Postgres para perguntas quantitativas/agregadas.
- semantic_search: busca mensagens por palavras-chave para perguntas qualitativas ("o que reclamam", "resuma dúvidas sobre X").

Esquema (Postgres):
- conversations(conversation_id text, channel text, status text, is_ai_enabled bool, user_name text,
    first_message_at timestamptz, last_message_at timestamptz, message_count int, frustration numeric,
    summary text, destino_principal text, destinos text[], assunto text, resolvida enum('sim','nao','parcial'),
    sentimento enum('positivo','neutro','negativo'), intencao_compra text, ctwa_headline text)
- messages(conversation_id text, role enum('user','agent'), content text, created_at timestamptz)
- nps_ratings(conversation_id text, rating int, comment text, completed_at timestamptz)

Regras:
- Sempre inclua conversation_id quando fizer sentido, para poder citar as fontes.
- Use ILIKE para texto; sempre use LIMIT em SELECTs que possam retornar muitas linhas.
- Datas: use now() e intervalos (ex.: last_message_at >= now() - interval '7 days').
- Responda em português, de forma objetiva. Cite os conversation_id que embasam a resposta.
- Nunca invente dados: baseie-se apenas nos resultados das ferramentas.`;

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

export async function runAgent(message: string, history: ChatTurn[] = []): Promise<AgentReply> {
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

  for (let i = 0; i < 6; i++) {
    const resp = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1500,
      system: SYSTEM,
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

  return {
    answer: "A consulta ficou complexa demais. Tente reformular a pergunta de forma mais específica.",
    tools: toolsUsed,
    citations: [...citations].slice(0, 6),
  };
}
