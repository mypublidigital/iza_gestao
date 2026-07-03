"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Zap } from "lucide-react";
import { SAMPLE_PAYLOADS } from "@/lib/sample-payloads";

export default function EventSimulator() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [sending, setSending] = useState(false);

  const sample = SAMPLE_PAYLOADS[idx];

  async function dispara() {
    setSending(true);
    setResult(null);
    const t0 = performance.now();
    // injeta a hora real no envio (o payload exibido usa timestamp fixo)
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { ...sample.payload };
    if ("createdAt" in payload) payload.createdAt = now;
    if ("completedAt" in payload) payload.completedAt = now;
    try {
      const res = await fetch("/api/webhooks/chatvolt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-chatvolt-secret": secret } : {}),
        },
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      setResult({ status: res.status, ms: Math.round(performance.now() - t0), body });
      router.refresh();
    } catch (e) {
      setResult({ status: 0, ms: Math.round(performance.now() - t0), body: String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-foreground">Tipo de evento</span>
          <select
            value={idx}
            onChange={(e) => {
              setIdx(Number(e.target.value));
              setResult(null);
            }}
            className="w-full rounded-lg border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {SAMPLE_PAYLOADS.map((s, i) => (
              <option key={s.eventType} value={i}>
                {s.eventType} — {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-foreground">
            Header <code className="text-xs text-muted">x-chatvolt-secret</code> (opcional)
          </span>
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="deixe vazio se não configurado"
            className="w-full rounded-lg border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
        {JSON.stringify(sample.payload, null, 2)}
      </pre>

      <div className="flex items-center gap-3">
        <button
          onClick={dispara}
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:opacity-50"
        >
          <Zap size={16} />
          {sending ? "Enviando…" : "Disparar para o webhook"}
        </button>
        {result && (
          <span
            className={`text-sm font-medium ${
              result.status === 200 ? "text-positivo" : "text-negativo"
            }`}
          >
            HTTP {result.status} · {result.ms}ms · {result.body}
          </span>
        )}
      </div>
    </div>
  );
}
