// Store em memória para a fase local-first (substitui a tabela raw_events do Supabase).
// Vive no processo do servidor Next — suficiente para validar o fluxo de ingestão.
// Em produção: INSERT em raw_events e um Vercel Cron drena os não processados.

import type { EventType, RawEvent } from "@/lib/types";

declare global {
  // eslint-disable-next-line no-var
  var __izaIngest: RawEvent[] | undefined;
}

const store: RawEvent[] = globalThis.__izaIngest ?? (globalThis.__izaIngest = []);

export function pushRawEvent(e: {
  eventType: EventType;
  conversationId: string;
  messageId?: string;
  payload: Record<string, unknown>;
  authValid: boolean;
}): RawEvent {
  const evt: RawEvent = {
    id: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    eventType: e.eventType,
    conversationId: e.conversationId,
    messageId: e.messageId,
    payload: e.payload,
    authValid: e.authValid,
    receivedAt: new Date().toISOString(),
    processed: false,
  };
  store.unshift(evt);
  if (store.length > 200) store.pop();
  return evt;
}

export function getRecentIngested(limit = 50): RawEvent[] {
  return store.slice(0, limit);
}
