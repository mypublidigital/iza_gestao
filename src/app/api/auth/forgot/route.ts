import { NextResponse } from "next/server";
import { verifyTurnstile } from "@/lib/turnstile";

// Apenas valida o captcha. O envio do e-mail de recuperação é feito no cliente
// (resetPasswordForEmail no navegador), para o fluxo PKCE do link funcionar.
export async function POST(req: Request) {
  const { captchaToken } = (await req.json()) as { captchaToken?: string };
  const ip = req.headers.get("x-forwarded-for");
  if (!(await verifyTurnstile(captchaToken ?? null, ip))) {
    return NextResponse.json({ error: "captcha" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
