// Cliente Anthropic (Claude) para uso no SERVIDOR. Retorna null se a chave não estiver
// configurada, para o app seguir funcionando sem enriquecimento na fase local-first.

import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null | undefined;

export function getAnthropic(): Anthropic | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = apiKey ? new Anthropic({ apiKey }) : null;
  return cached;
}

// Enriquecimento usa Sonnet: mais confiável que o Haiku no tool use (o Haiku vazava
// a sintaxe interna da ferramenta no destino) e classifica melhor destino/assunto.
export const ENRICH_MODEL = "claude-sonnet-4-6";
export const AGENT_MODEL = process.env.ANTHROPIC_MODEL_AGENT ?? "claude-sonnet-4-6";
