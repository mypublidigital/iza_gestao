"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Square } from "lucide-react";

export default function ImportButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const stop = useRef(false);

  async function run() {
    setRunning(true);
    stop.current = false;
    let cursor: string | null = null;
    let total = 0;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (stop.current) {
          setMsg(`Interrompido. ${total} conversa(s) importada(s) até aqui.`);
          break;
        }
        const res = await fetch("/api/import/chatvolt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        const d = (await res.json()) as {
          ok: boolean;
          imported: number;
          nextCursor: string | null;
          total: number;
          done: boolean;
          error?: string;
        };
        if (!d.ok) {
          setMsg(`Erro: ${d.error ?? "desconhecido"}`);
          break;
        }
        total += d.imported;
        cursor = d.nextCursor;
        setMsg(`Importando… ${total} conversa(s) (de ~${d.total} contatos)`);
        if (d.done || !cursor) {
          setMsg(`Concluído! ${total} conversa(s) importada(s). A IA vai classificá-las aos poucos.`);
          router.refresh();
          break;
        }
      }
    } catch (e) {
      setMsg(`Erro: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
      >
        <Download size={16} />
        {running ? "Importando…" : "Importar histórico do Chatvolt"}
      </button>
      {running && (
        <button
          onClick={() => (stop.current = true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
        >
          <Square size={13} /> Parar
        </button>
      )}
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}
