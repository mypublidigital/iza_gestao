// Enriquecimento — classifica cada conversa com Claude (Sonnet) via tool use estruturado.
// Preenche em `conversations`: destino_principal, destinos, assunto, resolvida, sentimento, intencao_compra.
//
// Robustez: sanitiza a saída (o modelo pode, raramente, vazar marcação) e o "assunto" é texto livre
// e específico (para desagrupar o genérico "Outro" e mostrar o motivo real do contato).

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropic, ENRICH_MODEL } from "@/lib/anthropic";

const TOOL: Anthropic.Tool = {
  name: "classificar_conversa",
  description: "Registra a classificação de uma conversa de atendimento de uma agência de turismo.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      destino_principal: {
        type: "string",
        description:
          'Principal destino de viagem mencionado (cidade/região/país, ex.: "Buenos Aires", "Porto de Galinhas", "Disney/Orlando"). Use "" (vazio) se nenhum destino for mencionado. NUNCA escreva marcação ou colchetes.',
      },
      destinos: {
        type: "array",
        items: { type: "string" },
        description: "Todos os destinos citados (lista vazia se nenhum).",
      },
      assunto: {
        type: "string",
        description:
          'Motivo específico do contato, em português, curto (2 a 5 palavras, em Maiúsculas Iniciais). ' +
          'Seja específico — evite o genérico "Outro". Exemplos: "Cotação de pacote", "Reclamação de hotel", ' +
          '"Dúvida sobre visto", "Alteração de reserva", "Formas de pagamento", "Seguro viagem", ' +
          '"Disponibilidade de datas", "Pós-venda", "Roteiro e passeios", "Saudação inicial". ' +
          'Se realmente não der para inferir, use "Contato sem intenção clara".',
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
    required: ["destino_principal", "destinos", "assunto", "resolvida", "sentimento", "intencao_compra"],
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

// Rejeita valores com marcação/vazamento e limita tamanho.
function cleanStr(v: unknown, maxLen = 60): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (/[<>]|parameter\s*name|antml/i.test(s)) return null;
  if (s.length > maxLen) return null;
  return s;
}

const SYSTEM =
  "Você classifica conversas de atendimento de uma agência de turismo brasileira (cliente × agente de IA no WhatsApp). " +
  "Analise TODA a transcrição (mensagens do cliente e do agente) e chame a ferramenta classificar_conversa. " +
  "Seja específico no assunto para revelar o motivo real do contato. Responda apenas via a ferramenta.";

async function classificar(anthropic: Anthropic, transcript: string): Promise<Classificacao | null> {
  const msg = await anthropic.messages.create({
    model: ENRICH_MODEL,
    max_tokens: 1024,
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

/** Enriquece conversas ainda não classificadas (enriched_at IS NULL) que tenham mensagens.
 *  O processador zera enriched_at quando chegam mensagens novas, então isto também re-enriquece
 *  conversas que cresceram — mantendo a classificação sempre atualizada. */
export async function enrichPending(sb: SupabaseClient, batchSize = 8): Promise<EnrichResult> {
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
        .order("created_at", { ascending: true })
        .limit(60);

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
          destino_principal: cleanStr(c.destino_principal),
          destinos: (Array.isArray(c.destinos) ? c.destinos : [])
            .map((d) => cleanStr(d))
            .filter((d): d is string => Boolean(d)),
          assunto: cleanStr(c.assunto) ?? "Contato sem intenção clara",
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
