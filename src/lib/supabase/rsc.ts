// Cliente Supabase para SERVER COMPONENTS / route handlers — lê a sessão dos cookies.
// Usado para saber quem está logado (auth). Separado do cliente admin (service_role).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function createSupabaseRSC() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado de um Server Component: o middleware cuida do refresh do cookie.
          }
        },
      },
    },
  );
}

/** Usuário logado (ou null). Retorna null quando o auth não está configurado. */
export async function getSessionUser() {
  if (!isAuthConfigured()) return null;
  const sb = await createSupabaseRSC();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}
