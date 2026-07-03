// POST /api/webhooks/chatvolt — endpoint de ingestão do Chatvolt.
//
// Arquitetura crítica (docs.chatvolt.ai/agent/webhooks):
//   receber → validar header → gravar payload bruto → responder 200 IMEDIATAMENTE
//   → processar/enriquecer de forma assíncrona (Vercel Cron drena raw_events).
// NUNCA chamar a API do Claude de forma síncrona aqui (health check exige < 5s; alvo < 300ms).

import { NextResponse } from "next/server";
import { pushRawEvent } from "@/lib/ingest-store";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { EventType } from "@/lib/types";

// O Chatvolt envia o segredo no header "Authorization" (campo "Header → Autorização").
// Aceitamos também "x-chatvolt-secret" por compatibilidade. Um eventual prefixo "Bearer " é removido.
function getProvidedSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) return auth.replace(/^Bearer\s+/i, "").trim();
  return req.headers.get("x-chatvolt-secret");
}

export async function POST(req: Request) {
  // 1) Validação do header de autenticação (opcional, conforme configurado no Chatvolt).
  const secret = process.env.CHATVOLT_WEBHOOK_SECRET;
  const provided = getProvidedSecret(req);
  const authValid = !secret || provided === secret;
  if (secret && !authValid) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) Parse defensivo do corpo.
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const eventType = (body.eventType as EventType) ?? "AGENT_USER_MESSAGE";
  const conversationId = (body.conversationId as string) ?? "unknown";

  // 3) Grava o payload bruto (fonte da verdade) e responde já.
  //    O processamento/normalização/enriquecimento acontece fora do request (Vercel Cron).
  const messageId = body.messageId as string | undefined;
  const supabase = getSupabaseAdmin();

  if (supabase) {
    // Idempotência: ignora duplicado por message_id (unique index parcial).
    const { error } = await supabase.from("raw_events").insert({
      event_type: eventType,
      conversation_id: conversationId,
      message_id: messageId,
      payload: body,
      auth_valid: authValid,
    });
    // 23505 = unique_violation (evento repetido) → tratamos como sucesso idempotente.
    if (error && error.code !== "23505") {
      console.error("[webhook] falha ao gravar raw_event:", error.message);
      return NextResponse.json({ ok: false, error: "storage_error" }, { status: 500 });
    }
  } else {
    // Modo local-first sem Supabase: guarda em memória para o simulador.
    pushRawEvent({ eventType, conversationId, messageId, payload: body, authValid });
  }

  return NextResponse.json({ ok: true, received: eventType }, { status: 200 });
}

// Health check do Chatvolt ao salvar a URL (precisa responder rápido com 200).
export async function GET() {
  return NextResponse.json({ ok: true, service: "chatvolt-webhook" }, { status: 200 });
}
