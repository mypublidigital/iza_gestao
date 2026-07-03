// Cliente Supabase para uso no SERVIDOR (webhook, jobs, route handlers).
// Usa a SERVICE_ROLE_KEY — NUNCA importe este arquivo em componentes client.
// Retorna null se as variáveis não estiverem configuradas, para o app seguir
// funcionando em modo local-first (dados mockados) sem Supabase.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}

/** true quando o Supabase está configurado (temos URL + service role). */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
