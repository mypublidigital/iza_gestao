"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import Logo from "@/components/Logo";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

const inputCls =
  "w-full rounded-lg border bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<"loading" | "ok" | "invalid">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    // O cliente troca o code da URL por uma sessão de recuperação automaticamente.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setReady("ok");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady("ok");
      else setTimeout(() => setReady((r) => (r === "ok" ? r : "invalid")), 2500);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha deve ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("Não foi possível redefinir. O link pode ter expirado — solicite outro.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo height={52} />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Redefinir senha</h1>

        {ready === "loading" && <p className="mt-4 text-sm text-muted">Validando o link…</p>}

        {ready === "invalid" && (
          <div className="mt-4 space-y-4">
            <p className="rounded-lg bg-red-50 p-3 text-sm text-negativo">
              Link inválido ou expirado. Solicite um novo link de redefinição.
            </p>
            <Link href="/forgot-password" className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-strong">
              Solicitar novo link
            </Link>
          </div>
        )}

        {ready === "ok" &&
          (done ? (
            <p className="mt-4 rounded-lg bg-primary-soft p-3 text-sm text-primary-strong">
              Senha redefinida! Redirecionando para o login…
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Nova senha</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" className={inputCls} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-foreground">Confirmar nova senha</span>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" className={inputCls} />
              </label>
              {error && <p className="text-sm text-negativo">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
              >
                <KeyRound size={16} />
                {loading ? "Salvando…" : "Redefinir senha"}
              </button>
            </form>
          ))}
      </div>
    </div>
  );
}
