// Enriquecimento (Fase 4) — classifica cada conversa com Claude Haiku via tool use estruturado.
// Usa strict tool use (strict:true + tool_choice forçado) para garantir JSON válido no schema.
// Preenche em `conversations`: destino_principal, destinos, assunto, resolvida, sentimento, intencao_compra.

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropic, ENRICH_MODEL } from "@/lib/anthropic";

const ASSUNTOS = [
  "Cotação de pacote",
  "Dúvida sobre documentação/visto",
  "Reclamação",
  "Pós-venda",
  "Alteração de reserva",
  "Informação de preço",
  "Seguro viagem",
  "Disponibilidade de datas",
  "Outro",
] as const;

const TOOL: Anthropic.Tool = {
  name: "classificar_conversa",
  description:
    "Registra a classificação de uma conversa de atendimento de uma agência de turismo.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      destino_principal: {
        type: "string",
        description: 'Principal destino de viagem mencionado (ex.: "Maldivas", "Disney/Orlando"). "" se nenhum.',
      },
      destinos: {
        type: "array",
        items: { type: "string" },
        description: "Todos os destinos mencionados (pode ser vazio).",
      },
      assunto: {
        type: "string",
        enum: ASSUNTOS as unknown as string[],
        description: "Assunto/intenção principal da conversa.",
      },
      resolvida: {
        type: "string",
        enum: ["sim", "nao", "parcial"],
        description: "A dúvida/necessidade do cliente foi resolvida pelo agente?",
      },
      sentimento: {
        type: "string",
        enum: ["positivo", "neutro", "negativo"],
        description: "Sentimento geral do cliente na conversa.",
      },
      intencao_compra: {
        type: "string",
        enum: ["alta", "media", "baixa", "nenhuma"],
        description: "Sinais de intenção de compra/fechamento.",
      },
    },
    required: [
      "destino_principal",
      "destinos",
      "assunto",
      "resolvida",
      "sentimento",
      "intencao_compra",
    ],
  },
};

interface Classificacao {
  destino_principal: string;
  destinos: string[];
  assunto: string;
  resolvida: "sim" | "nao" | "parcial";
  sentimento: "positivo" | "neutro" | "negativo";
  intencao_compra: "alta" | "media" | "baixa" | "nenhuma";
}

const SYSTEM =
  "Você classifica conversas de atendimento de uma agência de turismo brasileira (cliente × agente de IA no WhatsApp). " +
  "Analise a transcrição e chame a ferramenta classificar_conversa com a classificação. Responda em português.";

async function classificar(
  anthropic: Anthropic,
  transcript: string,
): Promise<Classificacao | null> {
  const msg = await anthropic.messages.create({
    model: ENRICH_MODEL,
    max_tokens: 512,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "classificar_conversa" },
    messages: [{ role: "user", content: transcript }],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  return block.input as Classificacao;
}

export interface EnrichResult {
  enriched: number;
  errors: number;
}

/** Enriquece conversas ainda não classificadas (enriched_at IS NULL) que tenham mensagens. */
export async function enrichPending(
  sb: SupabaseClient,
  batchSize = 5,
): Promise<EnrichResult> {
  const anthropic = getAnthropic();
  if (!anthropic) return { enriched: 0, errors: 0 };

  const { data: convs, error } = await sb
    .from("conversations")
    .select("conversation_id")
    .is("enriched_at", null)
    .gt("message_count", 0)
    .order("last_message_at", { ascending: false })
    .limit(batchSize);
  if (error) throw new Error(`enrich select: ${error.message}`);
  if (!convs?.length) return { enriched: 0, errors: 0 };

  let enriched = 0;
  let errors = 0;

  for (const { conversation_id } of convs) {
    try {
      const { data: msgs } = await sb
        .from("messages")
        .select("role,content,created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true });

      const transcript = (msgs ?? [])
        .map((m) => `${m.role === "user" ? "Cliente" : "Agente"}: ${m.content}`)
        .join("\n");
      if (!transcript.trim()) continue;

      const c = await classificar(anthropic, transcript);
      if (!c) {
        errors++;
        continue;
      }

      await sb
        .from("conversations")
        .update({
          destino_principal: c.destino_principal?.trim() || null,
          destinos: (c.destinos ?? []).filter((d) => d?.trim()),
          assunto: c.assunto,
          resolvida: c.resolvida,
          sentimento: c.sentimento,
          intencao_compra: c.intencao_compra,
          enriched_at: new Date().toISOString(),
        })
        .eq("conversation_id", conversation_id);
      enriched++;
    } catch (e) {
      console.error(`[enrich] ${conversation_id}:`, e);
      errors++;
    }
  }

  return { enriched, errors };
}
