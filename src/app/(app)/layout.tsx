import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Defesa extra além do middleware: sem sessão (com auth ativo) → login.
  if (isAuthConfigured() && !user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user?.email ?? null} />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
