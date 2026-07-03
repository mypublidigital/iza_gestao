import type { Canal, Sentimento } from "@/lib/types";

export const nf = new Intl.NumberFormat("pt-BR");
export const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const pct = (v: number, frac = 0) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: frac })}%`;

export const num = (v: number, frac = 0) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: frac });

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export const CANAL_LABEL: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  webchat: "Webchat",
  telegram: "Telegram",
};

export const SENTIMENTO_LABEL: Record<Sentimento, string> = {
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
};

export const SENTIMENTO_VAR: Record<Sentimento, string> = {
  positivo: "var(--positivo)",
  neutro: "var(--neutro)",
  negativo: "var(--negativo)",
};

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
