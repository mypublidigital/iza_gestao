// /api/dev/seed — popula o banco com conversas de exemplo via o pipeline real.
// Insere raw_events → processa → enriquece. Área admin (fase de validação).

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";
import { processRawEvents } from "@/lib/processor";
import { enrichPending } from "@/lib/enrich";
import { buildSeedRows } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (isAuthConfigured() && !(await getSessionUser())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }
  try {
    const rows = buildSeedRows(15);
    const { error } = await sb.from("raw_events").insert(rows);
    if (error && error.code !== "23505") throw new Error(error.message);

    const proc = await processRawEvents(sb, 200);
    // Enriquece tudo que foi criado (batch grande) para o dashboard já ficar completo.
    const enrich = await enrichPending(sb, 40);

    return NextResponse.json({ ok: true, inserted: rows.length, ...proc, ...enrich });
  } catch (e) {
    console.error("[dev/seed]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
