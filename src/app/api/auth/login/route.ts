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

  const sb = await createSupabaseRSC();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "credenciais" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
