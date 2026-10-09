import Link from "next/link";
import { ClockIcon, ShieldCheckIcon, ExternalLinkIcon } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdmin } from "@/lib/auth/session";

export default async function SuperAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSuperAdmin();

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Barra de Navegação Superior Master */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/super-admin" className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <ClockIcon className="size-4" />
            </span>
            <span className="font-bold tracking-tight text-sm sm:text-base hidden sm:inline">
              Sis.Chronos
            </span>
          </Link>

          <span className="text-muted-foreground/40 hidden sm:inline">/</span>

          <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 gap-1 px-2.5 py-0.5 text-xs font-semibold">
            <ShieldCheckIcon className="size-3.5" />
            Super Admin
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-xs font-medium text-foreground">{user.email}</p>
            <p className="text-[10px] text-muted-foreground">Administrador Geral</p>
          </div>

          <Link
            href="/inicio"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-muted"
            title="Ir para o ambiente de empresa normal"
          >
            <span>Ir para Empresa</span>
            <ExternalLinkIcon className="size-3" />
          </Link>

          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 sm:p-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
