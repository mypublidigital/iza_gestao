"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bot, Database, Search, Send, User } from "lucide-react";
import { PageHeader } from "@/components/ui";
import type { AgentReply, AgentToolCall } from "@/app/api/agente/route";

interface Turn {
  role: "user" | "agent";
  text: string;
  tools?: AgentToolCall[];
  citations?: string[];
}

const SUGESTOES = [
  "Quais os destinos mais consultados?",
  "Resuma as reclamações sobre preço e hotel",
  "Qual o NPS médio?",
  "Quais conversas ficaram sem resolução?",
  "Quantas pessoas perguntaram sobre Maldivas?",
];

export default function AgentePage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const history = turns.map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch("/api/agente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data: AgentReply = await res.json();
      setTurns((t) => [
        ...t,
        { role: "agent", text: data.answer, tools: data.tools, citations: data.citations },
      ]);
    } catch {
      setTurns((t) => [...t, { role: "agent", text: "Erro ao consultar o agente." }]);
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title="Agente"
        subtitle="Pergunte em linguagem natural sobre as conversas atendidas pela IA"
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {turns.length === 0 && (
            <div className="rounded-2xl border bg-surface p-6 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
                <Bot size={24} />
              </span>
              <p className="text-sm text-muted">
                Faça uma pergunta sobre o que a IA conversou com os clientes. Exemplos:
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border bg-surface px-3 py-1.5 text-sm text-foreground transition hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <Message key={i} turn={t} />
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Bot size={16} /> Analisando conversas…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t bg-surface px-8 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-3xl items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo sobre as conversas..."
            className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-strong disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted">
          Modo protótipo — respostas computadas sobre dados simulados. Em produção: Claude Sonnet com tool use real.
        </p>
      </div>
    </div>
  );
}

function Message({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-white">
          {turn.text}
        </div>
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
          <User size={15} />
        </span>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
        <Bot size={15} />
      </span>
      <div className="max-w-[80%] space-y-2">
        {turn.tools && turn.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {turn.tools.map((t, i) => (
              <span
                key={i}
                title={t.detail}
                className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted"
              >
                {t.tool === "query_database" ? <Database size={11} /> : <Search size={11} />}
                {t.tool}
              </span>
            ))}
          </div>
        )}
        <div
          className="rounded-2xl rounded-tl-sm border bg-surface px-4 py-2.5 text-sm text-foreground [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: renderMd(turn.text) }}
        />
        {turn.citations && turn.citations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>Fontes:</span>
            {turn.citations.map((id) => (
              <Link
                key={id}
                href={`/conversas/${id}`}
                className="rounded-md bg-primary-soft px-2 py-0.5 font-medium text-primary-strong hover:underline"
              >
                {id}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// mini-render de **negrito** -> <strong> (seguro: escapa HTML antes)
function renderMd(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
