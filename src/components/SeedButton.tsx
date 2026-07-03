"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";

export default function SeedButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dev/seed", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMsg(
          `Criadas ${data.conversations} conversa(s) de exemplo, ${data.enriched} enriquecida(s) pela IA. Veja o Dashboard.`,
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
        className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary-soft px-4 py-2 text-sm font-medium text-primary-strong transition hover:bg-primary hover:text-white disabled:opacity-50"
      >
        <Sparkles size={16} className={running ? "animate-pulse" : ""} />
        {running ? "Gerando e classificando…" : "Popular com dados de exemplo"}
      </button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
