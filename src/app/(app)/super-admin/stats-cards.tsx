import { Building2Icon, CheckCircle2Icon, ClockIcon, ShieldAlertIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type TenantStats = {
  total: number;
  active: number;
  trialing: number;
  suspended: number;
};

export function StatsCards({ stats }: { stats: TenantStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2Icon className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total de Empresas</p>
            <p className="text-2xl font-bold tracking-tight">{stats.total}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2Icon className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Empresas Ativas</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.active}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ClockIcon className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Em Avaliação (Trial)</p>
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {stats.trialing}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldAlertIcon className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Suspensas / Vencidas</p>
            <p className="text-2xl font-bold tracking-tight text-destructive">
              {stats.suspended}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
