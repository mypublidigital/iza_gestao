// Importador de histórico do Chatvolt.
// A API do Chatvolt não lista conversas diretamente, mas cada CONTATO traz o latestConversationId.
// Estratégia: paginar contatos (cursor) → buscar cada conversa completa → gravar no nosso banco.
// Roda em lotes (resumível via cursor) e marca enriched_at=null para o Cron classificar depois.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeStatus } from "@/lib/status";

const BASE = "https://app.chatvolt.ai";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function cvGet(path: string): Promise<any> {
  const key = process.env.CHATVOLT_API_KEY;
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Chatvolt ${path}: ${res.status}`);
  return res.json();
}

async function importConversation(sb: SupabaseClient, conv: any, contact: any): Promise<void> {
  const id = conv.id as string;
  const nome = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || undefined;

  // 1) Conversa (upsert).
  await sb.from("conversations").upsert(
    {
      conversation_id: id,
      organization_id: contact?.organizationId ?? conv?.organizationId ?? "org_isatravel",
      channel: conv.channel ?? null,
      status: normalizeStatus(conv.status),
      is_ai_enabled: conv.isAiEnabled ?? true,
      user_name: nome,
      user_phone: contact?.phoneNumber ?? undefined,
      user_email: contact?.email ?? undefined,
      frustration: typeof conv.frustration === "number" ? conv.frustration : null,
      enriched_at: null, // será classificada pelo Cron
    },
    { onConflict: "conversation_id" },
  );

  // 2) Mensagens (substitui as existentes para ser idempotente).
  const msgs = (Array.isArray(conv.messages) ? conv.messages : [])
    .filter((m: any) => typeof m.text === "string" && m.text.trim())
    .map((m: any) => ({
      conversation_id: id,
      message_id: m.id,
      role: m.from === "agent" ? "agent" : "user",
      content: String(m.text).slice(0, 8000),
      created_at: m.createdAt ?? conv.createdAt ?? new Date().toISOString(),
    }))
    .sort((a: any, b: any) => +new Date(a.created_at) - +new Date(b.created_at));

  await sb.from("messages").delete().eq("conversation_id", id);
  if (msgs.length) await sb.from("messages").insert(msgs);

  // 3) NPS.
  await sb.from("nps_ratings").delete().eq("conversation_id", id);
  if (typeof conv.npsRating === "number") {
    await sb.from("nps_ratings").insert({
      conversation_id: id,
      rating: conv.npsRating,
      comment: conv.npsComment ?? undefined,
      completed_at: conv.npsCompletedAt ?? conv.updatedAt ?? new Date().toISOString(),
    });
  }

  // 4) Agregados.
  const first = msgs[0]?.created_at ?? conv.createdAt ?? null;
  const last = msgs[msgs.length - 1]?.created_at ?? conv.updatedAt ?? null;
  await sb
    .from("conversations")
    .update({ message_count: msgs.length, first_message_at: first, last_message_at: last })
    .eq("conversation_id", id);
}

export interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  nextCursor: string | null;
  done: boolean;
}

/** Importa um lote de conversas (a partir do cursor de contatos). */
export async function importChatvoltBatch(
  sb: SupabaseClient,
  cursor?: string | null,
  pageSize = 6,
): Promise<ImportResult> {
  if (!process.env.CHATVOLT_API_KEY) throw new Error("CHATVOLT_API_KEY não configurada");

  const params = new URLSearchParams({ limit: String(pageSize) });
  if (cursor) params.set("cursor", cursor);
  const page = await cvGet(`/api/contacts?${params.toString()}`);

  let imported = 0;
  let skipped = 0;
  for (const contact of page.contacts ?? []) {
    const convId = contact?.latestConversationId;
    if (!convId) {
      skipped++;
      continue;
    }
    try {
      const conv = await cvGet(`/api/conversations/${convId}`);
      await importConversation(sb, conv, contact);
      imported++;
    } catch (e) {
      console.error("[import] conversa", convId, e);
      skipped++;
    }
  }

  return {
    imported,
    skipped,
    total: page.count ?? 0,
    nextCursor: page.nextCursor ?? null,
    done: !page.hasMore,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
