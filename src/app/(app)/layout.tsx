import { ClockIcon } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { requireContext, ROLE_LABELS } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPendingCounts } from "@/lib/pending-actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile, tenant, employeeId } = await requireContext();
  const supabase = await createClient();

  const { missingDaysCount, pendingApprovalsCount } = await getPendingCounts({
    supabase,
    tenantId: tenant.id,
    employeeId,
    role: profile.role,
  });

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b bg-sidebar p-4 lg:h-svh lg:w-64 lg:border-r lg:border-sidebar-border lg:border-b-0">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClockIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{tenant.name}</p>
            <p className="text-xs text-muted-foreground">Apontamento</p>
          </div>
        </div>

        <div className="lg:flex-1">
          <AppNav role={profile.role} />
        </div>

        <div className="grid gap-2 border-t pt-4">
          <div className="flex items-start justify-between gap-2 px-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
              <Badge variant="secondary" className="mt-1">
                {ROLE_LABELS[profile.role]}
              </Badge>
            </div>
            <NotificationBell
              missingDaysCount={missingDaysCount}
              pendingApprovalsCount={pendingApprovalsCount}
              side="top"
              align="end"
            />
          </div>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden p-4 lg:p-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

