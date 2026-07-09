// Processador (Fase 3) — normaliza raw_events em conversations/messages/nps_ratings.
// Idempotente: mensagens deduplicadas por message_id; conversas via upsert; agregados
// recalculados a partir de `messages` (reprocessar não duplica contagens).
// Acionado pelo Vercel Cron via /api/jobs/process. NÃO chama o Claude (isso é a Fase 4).

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeStatus } from "@/lib/status";

interface RawRow {
  id: string;
  event_type: string;
  conversation_id: string;
  message_id: string | null;
  payload: Record<string, unknown>;
  received_at: string;
}

export interface ProcessResult {
  processed: number;
  conversations: number;
  messages: number;
  nps: number;
}

const MESSAGE_EVENTS = new Set([
  "USER_MESSAGE_RECEIVED",
  "AGENT_MESSAGE_SENDED",
  "AGENT_USER_MESSAGE",
  "AGENT_MESSAGE_FOLLOW_UP",
  "AGENT_MESSAGE_BLOCKED",
  "AGENT_MESSAGE_NOTED",
  "GROUP_MESSAGE_RECEIVED",
]);

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

/** Monta o objeto de upsert da conversa só com os campos presentes no payload. */
function buildConversationUpsert(p: Record<string, unknown>, conversationId: string) {
  const conv: Record<string, unknown> = {
    conversation_id: conversationId,
    organization_id: str(p.organizationId) ?? "org_isatravel",
  };
  const set = (k: string, v: unknown) => {
    if (v !== undefined && v !== null) conv[k] = v;
  };
  set("agent_id", str(p.agentId));
  set("agent_name", str(p.agentName));
  set("channel", str(p.channel));
  conv.status = normalizeStatus(str(p.conversationStatus));
  set("priority", str(p.conversationPriority));
  if (typeof p.isAiEnabled === "boolean") conv.is_ai_enabled = p.isAiEnabled;
  set("user_name", str(p.userName));
  set("user_email", str(p.userEmail));
  set("user_phone", str(p.userPhoneNumber));
  set("summary", str(p.summary));
  if (typeof p.frustration === "number") conv.frustration = p.frustration;

  const ctwa = Array.isArray(p.ctwaAttributions) ? p.ctwaAttributions[0] : undefined;
  if (ctwa && typeof ctwa === "object") {
    const c = ctwa as Record<string, unknown>;
    set("ctwa_headline", str(c.headline));
    set("ctwa_body", str(c.body));
    set("ctwa_source_url", str(c.sourceUrl));
    set("ctwa_media_type", str(c.mediaType));
    set("ctwa_clicked_at", str(c.clickedAt));
  }
  return conv;
}

/** Extrai 0..2 mensagens (usuário e/ou agente) de um evento. */
function buildMessages(e: RawRow) {
  const p = e.payload ?? {};
  const base = e.message_id ?? e.id;
  const createdAt = str(p.createdAt) ?? e.received_at;
  const out: Record<string, unknown>[] = [];
  const userMsg = str(p.userMessage);
  const agentMsg = str(p.agentResponse);
  if (userMsg)
    out.push({
      conversation_id: e.conversation_id,
      message_id: `${base}:user`,
      role: "user",
      content: userMsg,
      created_at: createdAt,
    });
  if (agentMsg)
    out.push({
      conversation_id: e.conversation_id,
      message_id: `${base}:agent`,
      role: "agent",
      content: agentMsg,
      created_at: createdAt,
    });
  return out;
}

export async function processRawEvents(
  sb: SupabaseClient,
  batchSize = 100,
): Promise<ProcessResult> {
  const { data, error } = await sb
    .from("raw_events")
    .select("id,event_type,conversation_id,message_id,payload,received_at")
    .eq("processed", false)
    .order("received_at", { ascending: true })
    .limit(batchSize);

  if (error) throw new Error(`raw_events select: ${error.message}`);
  const events = (data ?? []) as RawRow[];
  if (events.length === 0) return { processed: 0, conversations: 0, messages: 0, nps: 0 };

  const touched = new Set<string>();
  const processedIds: string[] = [];
  let messages = 0;
  let nps = 0;

  for (const e of events) {
    const p = e.payload ?? {};

    // 1) Conversa (upsert por conversation_id).
    const { error: cErr } = await sb
      .from("conversations")
      .upsert(buildConversationUpsert(p, e.conversation_id), { onConflict: "conversation_id" });
    if (cErr) throw new Error(`conversations upsert: ${cErr.message}`);
    touched.add(e.conversation_id);

    // 1b) Tags (tabelas tags + conversation_tags).
    if (Array.isArray(p.tags)) {
      for (const name of p.tags) {
        if (typeof name !== "string" || !name.trim()) continue;
        const { data: tagRow } = await sb
          .from("tags")
          .upsert({ name }, { onConflict: "name" })
          .select("id")
          .single();
        if (tagRow) {
          await sb
            .from("conversation_tags")
            .upsert(
              { conversation_id: e.conversation_id, tag_id: tagRow.id },
              { ignoreDuplicates: true },
            );
        }
      }
    }

    // 2) Mensagens (insert; ignora duplicado por message_id).
    for (const m of buildMessages(e)) {
      const { error: mErr } = await sb.from("messages").insert(m);
      if (!mErr) messages++;
      else if (mErr.code !== "23505") throw new Error(`messages insert: ${mErr.message}`);
    }

    // 3) NPS.
    if (e.event_type === "NPS_INTERACTION" && typeof p.rating === "number") {
      const { error: nErr } = await sb.from("nps_ratings").insert({
        conversation_id: e.conversation_id,
        rating: p.rating,
        comment: str(p.comment),
        completion_reason: str(p.completionReason),
        completed_at: str(p.completedAt) ?? e.received_at,
      });
      if (!nErr) nps++;
      else if (nErr.code !== "23505") throw new Error(`nps insert: ${nErr.message}`);
    }

    processedIds.push(e.id);
  }

  // 4) Recalcula agregados de cada conversa tocada (idempotente).
  for (const id of touched) {
    const { data: rows } = await sb
      .from("messages")
      .select("created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    const list = rows ?? [];
    await sb
      .from("conversations")
      .update({
        message_count: list.length,
        first_message_at: list[0]?.created_at ?? null,
        last_message_at: list[list.length - 1]?.created_at ?? null,
        // Chegou conteúdo novo → re-enriquecer (a classificação acompanha o crescimento da conversa).
        enriched_at: null,
      })
      .eq("conversation_id", id);
  }

  // 5) Marca eventos como processados.
  const { error: uErr } = await sb
    .from("raw_events")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .in("id", processedIds);
  if (uErr) throw new Error(`raw_events mark processed: ${uErr.message}`);

  return { processed: processedIds.length, conversations: touched.size, messages, nps };
}
