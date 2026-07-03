// /api/jobs/process — drena raw_events não processados (Fase 3).
// Acionado pelo Vercel Cron (GET) a cada minuto e pelo botão "Processar agora" (POST) na área admin.
// Protegido por CRON_SECRET quando definido (o Vercel Cron envia Authorization: Bearer <CRON_SECRET>).

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";
import { processRawEvents } from "@/lib/processor";
import { enrichPending } from "@/lib/enrich";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Autorizado se: (a) Vercel Cron com CRON_SECRET, (b) equipe logada (botão admin), ou (c) dev sem auth.
async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (!isAuthConfigured()) return true;
  return Boolean(await getSessionUser());
}

async function run(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }
  try {
    const result = await processRawEvents(sb);
    // Enriquecimento assíncrono (Claude). Não bloqueia se a chave não estiver configurada.
    const enrich = await enrichPending(sb);
    return NextResponse.json({ ok: true, ...result, ...enrich });
  } catch (e) {
    console.error("[jobs/process]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
