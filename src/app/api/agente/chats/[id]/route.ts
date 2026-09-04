import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";
import { deleteChat, loadMessages } from "@/lib/agent-store";

export const dynamic = "force-dynamic";

async function guard() {
  const user = isAuthConfigured() ? await getSessionUser() : null;
  return { ok: !(isAuthConfigured() && !user), userId: user?.id ?? null };
}

// Abre uma conversa (mensagens salvas)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { ok } = await guard();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ messages: [] });
  return NextResponse.json({ messages: await loadMessages(sb, id) });
}

// Exclui uma conversa
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { ok, userId } = await guard();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "supabase" }, { status: 503 });
  await deleteChat(sb, id, userId);
  return NextResponse.json({ ok: true });
}
