import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b bg-surface px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({
  children,
  className,
  title,
  hint,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  hint?: string;
}) {
  return (
    <section
      className={clsx("rounded-2xl border bg-surface p-5 shadow-sm", className)}
    >
      {title && (
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {hint && <span className="text-xs text-muted">{hint}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean } | null;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border bg-surface p-5 shadow-sm",
        accent && "ring-1 ring-primary/20",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {delta && (
        <p
          className={clsx(
            "mt-1 text-xs font-medium",
            delta.positive ? "text-positivo" : "text-negativo",
          )}
        >
          {delta.positive ? "▲" : "▼"} {delta.value}
        </p>
      )}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  primary: "bg-primary-soft text-primary-strong",
  accent: "bg-accent-soft text-accent",
  positivo: "bg-green-100 text-green-700",
  neutro: "bg-amber-100 text-amber-700",
  negativo: "bg-red-100 text-red-700",
  slate: "bg-slate-100 text-slate-600",
};

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
