import { NextResponse } from "next/server";
import { createSupabaseRSC } from "@/lib/supabase/rsc";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(req: Request) {
  const { email, password, captchaToken } = (await req.json()) as {
    email: string;
    password: string;
    captchaToken?: string;
  };

  const ip = req.headers.get("x-forwarded-for");
  if (!(await verifyTurnstile(captchaToken ?? null, ip))) {
    return NextResponse.json({ error: "captcha" }, { status: 400 });
  }
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "dados" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const sb = await createSupabaseRSC();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/login` },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // Se a confirmação de e-mail estiver ativa no Supabase, a sessão vem nula.
  const precisaConfirmar = !data.session;
  return NextResponse.json({ ok: true, precisaConfirmar });
}
