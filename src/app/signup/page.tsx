"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import Logo from "@/components/Logo";
import Turnstile from "@/components/Turnstile";

const inputCls =
  "w-full rounded-lg border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha deve ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, captchaToken: captcha }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error === "captcha" ? "Confirme o captcha." : "Não foi possível criar a conta.");
      return;
    }
    setOk(
      data.precisaConfirmar
        ? "Conta criada! Confira seu e-mail para confirmar antes de entrar."
        : "Conta criada com sucesso! Você já pode entrar.",
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo height={52} />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Criar conta</h1>
        <p className="mt-1 text-sm text-muted">Cadastre seu acesso à plataforma.</p>

        {ok ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg bg-primary-soft p-3 text-sm text-primary-strong">{ok}</p>
            <Link
              href="/login"
              className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-strong"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Senha</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">Confirmar senha</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" className={inputCls} />
            </label>

            <Turnstile onToken={setCaptcha} />

            {error && <p className="text-sm text-negativo">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
            >
              <UserPlus size={16} />
              {loading ? "Criando…" : "Criar conta"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-muted">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
