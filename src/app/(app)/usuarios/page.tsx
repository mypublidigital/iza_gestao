"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, KeyRound } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { dataHora } from "@/lib/format";

interface TeamUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignIn: string | null;
  confirmed: boolean;
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(`Erro: ${data.error}`);
    setEmail("");
    setPassword("");
    setMsg("Usuário criado.");
    load();
  }

  async function remover(u: TeamUser) {
    if (!confirm(`Remover o usuário ${u.email}?`)) return;
    const res = await fetch(`/api/users?id=${u.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setMsg(`Erro: ${data.error}`);
    setMsg("Usuário removido.");
    load();
  }

  async function redefinir(u: TeamUser) {
    const nova = prompt(`Nova senha para ${u.email} (mín. 8 caracteres):`);
    if (!nova) return;
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, password: nova }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Senha de ${u.email} redefinida.` : `Erro: ${data.error}`);
  }

  const inputCls =
    "rounded-lg border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <>
      <PageHeader title="Usuários" subtitle="Gerencie os acessos da equipe à plataforma" />

      <div className="space-y-6 p-8">
        <Card title="Criar usuário">
          <form onSubmit={criar} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-foreground">E-mail</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} w-64`} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-foreground">Senha</span>
              <input type="text" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 8 caracteres" className={`${inputCls} w-56`} />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
            >
              <UserPlus size={16} />
              Criar
            </button>
            {msg && <span className="text-sm text-muted">{msg}</span>}
          </form>
        </Card>

        <Card title="Equipe" hint={`${users.length} usuário(s)`}>
          {loading ? (
            <p className="py-4 text-sm text-muted">Carregando…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="pb-2 font-medium">E-mail</th>
                    <th className="pb-2 font-medium">Criado</th>
                    <th className="pb-2 font-medium">Último acesso</th>
                    <th className="pb-2 font-medium">Confirmado</th>
                    <th className="pb-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-2">
                      <td className="py-2 pr-3 font-medium text-foreground">{u.email}</td>
                      <td className="py-2 pr-3 text-xs text-muted">{dataHora(u.createdAt)}</td>
                      <td className="py-2 pr-3 text-xs text-muted">{u.lastSignIn ? dataHora(u.lastSignIn) : "—"}</td>
                      <td className="py-2 pr-3">{u.confirmed ? "✅" : "⏳"}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => redefinir(u)} title="Redefinir senha" className="rounded-md border px-2 py-1 text-xs text-muted hover:text-foreground">
                            <KeyRound size={13} />
                          </button>
                          <button onClick={() => remover(u)} title="Remover" className="rounded-md border px-2 py-1 text-xs text-negativo hover:bg-red-50">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
