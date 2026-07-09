"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plane, LogIn } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  const inputCls =
    "w-full rounded-lg border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <Plane size={20} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Iza Travel</p>
            <p className="text-xs text-muted">Inteligência Conversacional</p>
          </div>
        </div>

        <h1 className="text-lg font-semibold text-foreground">Acesso da equipe</h1>
        <p className="mt-1 text-sm text-muted">Entre com suas credenciais.</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={inputCls}
            />
          </label>

          {error && <p className="text-sm text-negativo">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
          >
            <LogIn size={16} />
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Acesso restrito à equipe da Iza Travel. Novos usuários são criados por um administrador.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
