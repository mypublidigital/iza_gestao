import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";
import { listChats } from "@/lib/agent-store";

export const dynamic = "force-dynamic";

// Lista as conversas do usuário (lateral direita do chat)
export async function GET() {
  const user = isAuthConfigured() ? await getSessionUser() : null;
  if (isAuthConfigured() && !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ chats: [] });
  return NextResponse.json({ chats: await listChats(sb, user?.id ?? null) });
}
