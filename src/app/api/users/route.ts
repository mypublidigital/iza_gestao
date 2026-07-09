import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";

export const dynamic = "force-dynamic";

async function currentUser() {
  return isAuthConfigured() ? await getSessionUser() : null;
}
function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// Lista usuários
export async function GET() {
  if (isAuthConfigured() && !(await currentUser())) return unauthorized();
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "supabase" }, { status: 503 });
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 500 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    createdAt: u.created_at,
    lastSignIn: u.last_sign_in_at ?? null,
    confirmed: Boolean(u.email_confirmed_at),
  }));
  return NextResponse.json({ users });
}

// Cria usuário (já confirmado)
export async function POST(req: Request) {
  if (isAuthConfigured() && !(await currentUser())) return unauthorized();
  const { email, password } = (await req.json()) as { email: string; password: string };
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "Informe e-mail e senha (mín. 8 caracteres)." }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "supabase" }, { status: 503 });
  const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Define nova senha para um usuário
export async function PATCH(req: Request) {
  if (isAuthConfigured() && !(await currentUser())) return unauthorized();
  const { id, password } = (await req.json()) as { id: string; password: string };
  if (!id || !password || password.length < 8) {
    return NextResponse.json({ error: "Senha inválida (mín. 8 caracteres)." }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "supabase" }, { status: 503 });
  const { error } = await sb.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Remove usuário (não permite remover a si mesmo)
export async function DELETE(req: Request) {
  const me = await currentUser();
  if (isAuthConfigured() && !me) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
  if (me && me.id === id) {
    return NextResponse.json({ error: "Você não pode remover o próprio usuário." }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "supabase" }, { status: 503 });
  const { error } = await sb.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
