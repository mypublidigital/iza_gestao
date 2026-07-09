import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";
import { importChatvoltBatch } from "@/lib/chatvolt-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (isAuthConfigured() && !(await getSessionUser())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, error: "supabase" }, { status: 503 });

  try {
    const { cursor } = (await req.json().catch(() => ({}))) as { cursor?: string | null };
    const result = await importChatvoltBatch(sb, cursor ?? null);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[import/chatvolt]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
