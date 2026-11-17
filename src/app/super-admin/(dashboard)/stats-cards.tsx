import {
  ActivityIcon,
  AlertTriangleIcon,
  Building2Icon,
  CheckCircle2Icon,
  ClockIcon,
  DollarSignIcon,
  ShieldAlertIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type TenantStats = {
  total: number;
  active: number;
  trialing: number;
  suspended: number;
  mrr: number;
  arr: number;
  arpu?: number;
  expiringSoon: number;
  recentEntries: number;
  churnRiskCount?: number;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function StatsCards({ stats }: { stats: TenantStats }) {
  return (
    <div className="space-y-4">
      {/* Indicadores Financeiros e de Engajamento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10">
          <CardContent className="flex items-center gap-3.5 p-4 sm:p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <DollarSignIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">MRR Estimado</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
                {currencyFormatter.format(stats.mrr)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
              </p>
              {stats.arpu !== undefined && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  Ticket médio (ARPU):{" "}
                  <span className="font-medium text-foreground/80">
                    {currencyFormatter.format(stats.arpu)}
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/10">
          <CardContent className="flex items-center gap-3.5 p-4 sm:p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
              <TrendingUpIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">ARR Projetado</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 truncate">
                {currencyFormatter.format(stats.arr)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ano</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3.5 p-4 sm:p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <ActivityIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Apontamentos (30d)</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                {numberFormatter.format(stats.recentEntries)}
                <span className="text-xs font-normal text-muted-foreground ml-1">registros</span>
              </p>
              {stats.churnRiskCount !== undefined && (
                <p
                  className={`text-[11px] mt-0.5 truncate ${
                    stats.churnRiskCount > 0
                      ? "text-amber-600 dark:text-amber-400 font-medium"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {stats.churnRiskCount > 0
                    ? `${stats.churnRiskCount} ${
                        stats.churnRiskCount === 1 ? "empresa em alerta" : "empresas em alerta"
                      } (+7d sem uso)`
                    : "Todas as ativas engajadas"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={stats.expiringSoon > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
          <CardContent className="flex items-center gap-3.5 p-4 sm:p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangleIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">A Vencer (7 dias)</p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 truncate">
                {stats.expiringSoon}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {stats.expiringSoon === 1 ? "empresa" : "empresas"}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indicadores de Clientes / Licenciamento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
              <Building2Icon className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total de Empresas</p>
              <p className="text-lg font-bold tracking-tight">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2Icon className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Empresas Ativas</p>
              <p className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {stats.active}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <ClockIcon className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Em Avaliação (Trial)</p>
              <p className="text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {stats.trialing}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive shrink-0">
              <ShieldAlertIcon className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Suspensas / Vencidas</p>
              <p className="text-lg font-bold tracking-tight text-destructive">
                {stats.suspended}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
