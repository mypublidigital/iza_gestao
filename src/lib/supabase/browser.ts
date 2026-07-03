"use client";

// Cliente Supabase para o BROWSER (login/logout na UI). Usa a anon key (pública).

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
