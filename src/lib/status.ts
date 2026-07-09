import type { ConversationStatus } from "@/lib/types";

// Normaliza o status (cru do Chatvolt, ex.: RESOLVED/UNRESOLVED/HUMAN_REQUESTED)
// para o nosso padrão em português.
export function normalizeStatus(s?: string | null): ConversationStatus {
  const v = (s ?? "").toLowerCase();
  if (["resolvida", "resolved"].includes(v)) return "resolvida";
  if (["pendente", "pending"].includes(v)) return "pendente";
  if (
    ["transferida", "human_requested", "human_requested_close", "assigned", "human", "requires_human"].includes(v)
  )
    return "transferida";
  // unresolved / open / aberta / vazio / desconhecido → aberta
  return "aberta";
}
