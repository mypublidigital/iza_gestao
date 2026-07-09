"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import Logo from "@/components/Logo";
import Turnstile from "@/components/Turnstile";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

const inputCls =
  "w-full rounded-lg border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // 1) valida o captcha no servidor
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captchaToken: captcha }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      setError(data.error === "captcha" ? "Confirme o captcha." : "Erro. Tente novamente.");
      return;
    }
    // 2) dispara o e-mail de recuperação a partir do navegador (fluxo PKCE)
    const supabase = createSupabaseBrowser();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo height={52} />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted">Enviaremos um link de redefinição por e-mail.</p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg bg-primary-soft p-3 text-sm text-primary-strong">
              Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha. Verifique
              também a caixa de spam.
            </p>
            <Link
              href="/login"
              className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-strong"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
            </label>

            <Turnstile onToken={setCaptcha} />

            {error && <p className="text-sm text-negativo">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
            >
              <Mail size={16} />
              {loading ? "Enviando…" : "Enviar link"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-muted">
          <Link href="/login" className="text-primary hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
