// Leituras do Supabase (server-only). Usadas quando o banco está configurado e populado.
// Mapeiam as linhas (snake_case) para os tipos de domínio (camelCase) usados nas telas.

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  Canal,
  Conversation,
  ConversationStatus,
  IntencaoCompra,
  Message,
  Prioridade,
  RawEvent,
  Resolutividade,
  Sentimento,
  EventType,
} from "@/lib/types";

export interface ConversationPreview {
  conversationId: string;
  userName?: string;
  channel?: Canal;
  status?: string;
  messageCount: number;
  lastMessageAt?: string;
  summary?: string;
}

// ---------------- raw_events (área admin) ----------------

export async function dbLoadRawEvents(limit = 50): Promise<RawEvent[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("raw_events")
    .select("id,event_type,conversation_id,message_id,payload,auth_valid,received_at,processed,processed_at")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    eventType: r.event_type as EventType,
    conversationId: r.conversation_id,
    messageId: r.message_id ?? undefined,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    authValid: r.auth_valid,
    receivedAt: r.received_at,
    processed: r.processed,
    processedAt: r.processed_at ?? undefined,
  }));
}

export async function dbCountUnprocessed(): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { count } = await sb
    .from("raw_events")
    .select("*", { count: "exact", head: true })
    .eq("processed", false);
  return count ?? 0;
}

export async function dbLoadConversationsPreview(limit = 20): Promise<ConversationPreview[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("conversations")
    .select("conversation_id,user_name,channel,status,message_count,last_message_at,summary")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    conversationId: r.conversation_id,
    userName: r.user_name ?? undefined,
    channel: (r.channel as Canal) ?? undefined,
    status: r.status ?? undefined,
    messageCount: r.message_count ?? 0,
    lastMessageAt: r.last_message_at ?? undefined,
    summary: r.summary ?? undefined,
  }));
}

export async function dbCountConversations(): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const { count } = await sb.from("conversations").select("*", { count: "exact", head: true });
  return count ?? 0;
}

// ---------------- conversas completas (Dashboard / Conversas) ----------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(r: any, messages: Message[] = []): Conversation {
  const nps = Array.isArray(r.nps_ratings) ? r.nps_ratings[0] : undefined;
  const tags = Array.isArray(r.conversation_tags)
    ? r.conversation_tags.map((ct: any) => ct?.tags?.name).filter(Boolean)
    : [];
  const first = r.first_message_at ?? r.created_at;
  const last = r.last_message_at ?? r.created_at;
  return {
    conversationId: r.conversation_id,
    organizationId: r.organization_id,
    agentId: r.agent_id ?? "",
    agentName: r.agent_name ?? "",
    channel: (r.channel as Canal) ?? "whatsapp",
    status: (r.status as ConversationStatus) ?? "aberta",
    priority: (r.priority as Prioridade) ?? "media",
    isAiEnabled: r.is_ai_enabled ?? true,
    userName: r.user_name ?? undefined,
    userEmail: r.user_email ?? undefined,
    userPhone: r.user_phone ?? undefined,
    firstMessageAt: first,
    lastMessageAt: last,
    messageCount: r.message_count ?? messages.length,
    frustration: r.frustration != null ? Number(r.frustration) : 0,
    summary: r.summary ?? undefined,
    ctwa: r.ctwa_headline
      ? {
          headline: r.ctwa_headline,
          body: r.ctwa_body ?? undefined,
          sourceUrl: r.ctwa_source_url ?? undefined,
          mediaType: r.ctwa_media_type ?? undefined,
          clickedAt: r.ctwa_clicked_at ?? undefined,
        }
      : undefined,
    destinoPrincipal: r.destino_principal ?? undefined,
    destinos: r.destinos ?? [],
    assunto: r.assunto ?? "Não classificado",
    resolvida: (r.resolvida as Resolutividade) ?? "parcial",
    sentimento: (r.sentimento as Sentimento) ?? "neutro",
    intencaoCompra: (r.intencao_compra as IntencaoCompra) ?? "nenhuma",
    enrichedAt: r.enriched_at ?? undefined,
    tags,
    messages,
    nps: nps
      ? {
          id: `nps_${r.conversation_id}`,
          conversationId: r.conversation_id,
          rating: nps.rating,
          comment: nps.comment ?? undefined,
          completionReason: nps.completion_reason ?? undefined,
          completedAt: nps.completed_at ?? last,
        }
      : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const CONV_SELECT =
  "*, nps_ratings ( rating, comment, completion_reason, completed_at ), conversation_tags ( tags ( name ) )";

/** Todas as conversas do banco (sem mensagens — o Dashboard usa campos agregados). */
export async function dbLoadConversations(): Promise<Conversation[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("conversations")
    .select(CONV_SELECT)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  return data.map((r) => mapRow(r));
}

/** Uma conversa completa, com as mensagens. */
export async function dbLoadConversation(id: string): Promise<Conversation | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from("conversations").select(CONV_SELECT).eq("conversation_id", id).single();
  if (error || !data) return null;
  const { data: msgs } = await sb
    .from("messages")
    .select("id,message_id,role,content,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  const messages: Message[] = (msgs ?? []).map((m) => ({
    id: m.id,
    conversationId: id,
    messageId: m.message_id ?? m.id,
    role: m.role,
    content: m.content,
    createdAt: m.created_at,
  }));
  return mapRow(data, messages);
}
