// Memória do agente conversacional: conversas, mensagens e aprendizados.
// Tudo no backend (Supabase) — o chat sobrevive a recarregar a página e alimenta o contexto.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentToolCall, ChatTurn } from "@/lib/agent";

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredMessage {
  role: "user" | "agent";
  content: string;
  tools?: AgentToolCall[];
  citations?: string[];
}

/** Título curto a partir da primeira pergunta. */
function titleFrom(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  return t.length > 60 ? `${t.slice(0, 57)}…` : t || "Nova conversa";
}

export async function listChats(sb: SupabaseClient, userId: string | null): Promise<ChatSummary[]> {
  let q = sb.from("agent_chats").select("id,title,updated_at").order("updated_at", { ascending: false }).limit(50);
  q = userId ? q.eq("user_id", userId) : q.is("user_id", null);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
}

export async function createChat(
  sb: SupabaseClient,
  userId: string | null,
  firstMessage: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from("agent_chats")
    .insert({ user_id: userId, title: titleFrom(firstMessage) })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

export async function loadMessages(sb: SupabaseClient, chatId: string): Promise<StoredMessage[]> {
  const { data, error } = await sb
    .from("agent_messages")
    .select("role,content,tools,citations")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error || !data) return [];
  return data.map((m) => ({
    role: m.role as "user" | "agent",
    content: m.content,
    tools: (m.tools ?? undefined) as AgentToolCall[] | undefined,
    citations: m.citations ?? [],
  }));
}

/** Histórico no formato que o agente consome (só texto). */
export function toTurns(msgs: StoredMessage[]): ChatTurn[] {
  return msgs.map((m) => ({ role: m.role, text: m.content }));
}

export async function saveMessage(
  sb: SupabaseClient,
  chatId: string,
  msg: StoredMessage,
): Promise<void> {
  await sb.from("agent_messages").insert({
    chat_id: chatId,
    role: msg.role,
    content: msg.content,
    tools: msg.tools ?? null,
    citations: msg.citations ?? [],
  });
  await sb.from("agent_chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
}

export async function deleteChat(sb: SupabaseClient, chatId: string, userId: string | null): Promise<void> {
  let q = sb.from("agent_chats").delete().eq("id", chatId);
  q = userId ? q.eq("user_id", userId) : q.is("user_id", null);
  await q;
}

/** Aprendizados mais recentes, usados como contexto em novas conversas. */
export async function recentLearnings(sb: SupabaseClient, limit = 25): Promise<string[]> {
  const { data, error } = await sb
    .from("agent_learnings")
    .select("content")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((l) => l.content as string);
}

export async function saveLearnings(
  sb: SupabaseClient,
  chatId: string | null,
  learnings: string[],
): Promise<void> {
  const rows = learnings
    .map((c) => c.trim())
    .filter((c) => c.length > 8 && c.length < 300)
    .slice(0, 3)
    .map((content) => ({ chat_id: chatId, content }));
  if (!rows.length) return;
  // content é UNIQUE: ignora repetidos silenciosamente.
  await sb.from("agent_learnings").upsert(rows, { onConflict: "content", ignoreDuplicates: true });
}
