"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  MessagesSquare,
  Bot,
  Radio,
  Plane,
  LogOut,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversas", label: "Conversas", icon: MessagesSquare },
  { href: "/agente", label: "Agente", icon: Bot },
];

const NAV_ADMIN = [
  { href: "/eventos", label: "Integração & Testes", icon: Radio },
];

export default function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await createSupabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <aside className="flex w-64 flex-col border-r bg-surface px-4 py-5">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
          <Plane size={20} />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-foreground">ISA Travel</span>
          <span className="block text-xs text-muted">Inteligência Conversacional</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-primary-soft text-primary-strong"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}

        <p className="mt-5 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
          Administração
        </p>
        {NAV_ADMIN.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-primary-soft text-primary-strong"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">
                Admin
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        {userEmail ? (
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="truncate text-xs font-medium text-foreground" title={userEmail}>
              {userEmail}
            </p>
            <button
              onClick={logout}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
            >
              <LogOut size={13} />
              Sair
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
            <p className="font-medium text-foreground">Modo local</p>
            <p className="mt-1">Login desativado (sem Supabase configurado).</p>
          </div>
        )}
      </div>
    </aside>
  );
}
