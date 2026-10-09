import Link from "next/link";
import { ClockIcon, SparklesIcon } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { requireContext, ROLE_LABELS } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPendingCounts } from "@/lib/pending-actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile, tenant, employeeId, subscription, isSuperAdmin } = await requireContext();
  const supabase = await createClient();

  const { missingDaysCount, pendingApprovalsCount } = await getPendingCounts({
    supabase,
    tenantId: tenant.id,
    employeeId,
    role: profile.role,
  });

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b bg-sidebar p-4 lg:sticky lg:top-0 lg:h-svh lg:w-64 lg:border-r lg:border-sidebar-border lg:border-b-0 lg:overflow-hidden">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ClockIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{tenant.name}</p>
              <p className="text-xs text-muted-foreground">Apontamento</p>
            </div>
          </div>
          <NotificationBell
            missingDaysCount={missingDaysCount}
            pendingApprovalsCount={pendingApprovalsCount}
            side="bottom"
            align="start"
          />
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto lg:pr-1 min-h-0">
          <AppNav role={profile.role} isSuperAdmin={isSuperAdmin} />
        </div>

        <div className="grid gap-2 border-t pt-3 shrink-0">
          <div className="px-2 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              {isSuperAdmin && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Super Admin
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
            <Badge variant="secondary" className="mt-1">
              {ROLE_LABELS[profile.role]}
            </Badge>
          </div>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden p-4 lg:p-8">
        <div className="mx-auto w-full max-w-6xl">
          {subscription.isTrial && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong className="font-semibold">Período de avaliação:</strong> Você tem{" "}
                  <strong>{subscription.daysRemaining ?? 0} dias restantes</strong> de teste
                  gratuito com acesso total a todos os recursos.
                </span>
              </div>
              {profile.role === "admin" && (
                <Link
                  href="/configuracoes/assinatura"
                  className="font-medium underline hover:text-amber-950 dark:hover:text-amber-100 shrink-0"
                >
                  Ver assinatura &rarr;
                </Link>
              )}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

