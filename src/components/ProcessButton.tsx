"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cog } from "lucide-react";

export default function ProcessButton({ pending }: { pending: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/jobs/process", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMsg(
          `Processados ${data.processed} evento(s) → ${data.conversations} conversa(s), ${data.messages} mensagem(ns), ${data.nps} NPS. ` +
            `Enriquecidas pela IA: ${data.enriched ?? 0}.`,
        );
        router.refresh();
      } else {
        setMsg(`Erro: ${data.error ?? "desconhecido"}`);
      }
    } catch (e) {
      setMsg(`Erro: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        <Cog size={16} className={running ? "animate-spin" : ""} />
        {running ? "Processando…" : `Processar agora${pending ? ` (${pending} pendente${pending > 1 ? "s" : ""})` : ""}`}
      </button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
