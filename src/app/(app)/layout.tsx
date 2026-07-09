import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Logo from "@/components/Logo";
import { getSessionUser, isAuthConfigured } from "@/lib/supabase/rsc";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Defesa extra além do middleware: sem sessão (com auth ativo) → login.
  if (isAuthConfigured() && !user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user?.email ?? null} />
      <main className="flex-1 overflow-x-hidden">
        <div className="flex items-center justify-end border-b bg-surface px-8 py-2">
          <Logo height={30} />
        </div>
        {children}
      </main>
    </div>
  );
}
