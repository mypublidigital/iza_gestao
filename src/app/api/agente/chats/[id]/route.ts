import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";
import { deleteChat, loadMessages, ownsChat, renameChat } from "@/lib/agent-store";

export const dynamic = "force-dynamic";

async function guard() {
  const user = isAuthConfigured() ? await getSessionUser() : null;
  return { ok: !(isAuthConfigured() && !user), userId: user?.id ?? null };
}

// Abre uma conversa (mensagens salvas)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { ok, userId } = await guard();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ messages: [] });
  if (!(await ownsChat(sb, id, userId))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ messages: await loadMessages(sb, id) });
}

// Renomeia uma conversa
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { ok, userId } = await guard();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "supabase" }, { status: 503 });
  if (!title?.trim()) return NextResponse.json({ error: "title" }, { status: 400 });
  const done = await renameChat(sb, id, userId, title);
  return NextResponse.json({ ok: done }, { status: done ? 200 : 500 });
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
