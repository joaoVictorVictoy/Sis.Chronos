import Link from "next/link";
import { ArrowRightIcon, CalendarX2Icon, CheckCircle2Icon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { requireContext, ROLE_LABELS } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatHours, formatPercent, todayISO } from "@/lib/format";
import { addDays, endOfMonth, startOfMonth } from "@/lib/time";
import { resolvePeriod } from "@/lib/periods";
import { getProfitabilityReport } from "@/lib/server/metrics";
import { calculateSalaryProjection, type SalaryProjection } from "@/lib/salary-projection";
import type { HealthStatus } from "@/lib/profitability";
import type { HeatmapRawEntry, HeatmapRawLeave } from "@/lib/heatmap";
import { LeavesDialog, type LeaveRecord } from "../minhas-analises/leaves-dialog";
import { ActivityHeatmap } from "./activity-heatmap";

export const metadata = { title: "Início | Apontamento" };

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="bg-muted/40 shadow-none ring-foreground/5">
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

export default async function HomePage() {
  const { profile, tenant, employeeId, employeeMonthlyHours } = await requireContext();
  const isManager = profile.role === "admin" || profile.role === "gestor";
  const canSeeCosts = profile.role === "admin" || profile.can_view_costs;
  const effectiveMonthlyHours = employeeMonthlyHours ?? Number(tenant.monthly_hours);

  const today = todayISO();
  let rawEntries: HeatmapRawEntry[] = [];
  let rawLeaves: HeatmapRawLeave[] = [];
  let projection: SalaryProjection | null = null;

  if (employeeId) {
    const fromDate = addDays(today, -150);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const supabase = await createClient();
    const [{ data: breakdownData }, { data: leavesData }] = await Promise.all([
      supabase.rpc("my_hours_breakdown", { p_from: fromDate, p_to: today }),
      supabase
        .from("employee_leaves")
        .select("id, start_date, end_date, type, notes")
        .eq("employee_id", employeeId)
        .lte("start_date", monthEnd)
        .gte("end_date", fromDate),
    ]);
    rawEntries = (breakdownData ?? []) as HeatmapRawEntry[];
    rawLeaves = (leavesData ?? []) as HeatmapRawLeave[];

    const monthEntries = rawEntries.filter(
      (e) => e.entry_date >= monthStart && e.entry_date <= monthEnd,
    );
    const hoursLoggedMonth = monthEntries.reduce((sum, e) => sum + Number(e.hours), 0);

    projection = calculateSalaryProjection({
      baseSalary: null,
      monthlyHours: effectiveMonthlyHours,
      hoursLogged: hoursLoggedMonth,
      leaves: rawLeaves,
      monthISO: today,
    });
  }

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {profile.full_name.split(" ")[0]}</h1>
        <p className="text-muted-foreground">
          Você está em <span className="font-medium text-foreground">{tenant.name}</span> como{" "}
          {ROLE_LABELS[profile.role]}.
        </p>
      </header>

      {isManager ? (
        <>
          <ManagerSummary canSeeCosts={canSeeCosts} />
          {employeeId && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Seus apontamentos pessoais</h2>
                  <p className="text-xs text-muted-foreground">
                    Seus dias apontados e horas registradas por cliente.
                  </p>
                </div>
                <Button nativeButton={false} render={<Link href="/apontamentos" />} variant="outline" size="sm">
                  Lançar horas
                  <ArrowRightIcon />
                </Button>
              </div>
              <ActivityHeatmap
                entries={rawEntries}
                leaves={rawLeaves}
                today={today}
                monthlyHours={effectiveMonthlyHours}
              />
            </div>
          )}
        </>
      ) : (
        <CollaboratorSummary
          monthlyHours={effectiveMonthlyHours}
          isCustomHours={employeeMonthlyHours !== null}
          entries={rawEntries}
          leaves={rawLeaves}
          today={today}
          projection={projection}
        />
      )}

      {profile.role === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuração da empresa</CardTitle>
            <CardDescription>Dados, domínio corporativo e parâmetros de cálculo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/configuracoes/empresa" />} variant="outline">
              Configurar empresa
              <ArrowRightIcon />
            </Button>
            <Button nativeButton={false} render={<Link href="/configuracoes/usuarios" />}>
              Convidar equipe
              <ArrowRightIcon />
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** Resumo do mês (até hoje) para quem gerencia a empresa. */
async function ManagerSummary({ canSeeCosts }: { canSeeCosts: boolean }) {
  const period = resolvePeriod(todayISO());
  const report = await getProfitabilityReport(period);
  const totals = report.totals;

  const byStatus = report.contracts.reduce<Record<HealthStatus, number>>(
    (acc, item) => {
      acc[item.profitability.status] += 1;
      return acc;
    },
    { saudavel: 0, atencao: 0, critico: 0 },
  );

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>{canSeeCosts ? "Rentabilidade da empresa" : "Visão geral da empresa"}</CardTitle>
          <CardDescription>{period.label}</CardDescription>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard" />} variant="outline" size="sm">
          {canSeeCosts ? "Ver rentabilidade completa" : "Ver visão operacional"}
          <ArrowRightIcon />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        {canSeeCosts ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Receita líquida" value={formatCurrency(totals.netRevenue)} />
            <Kpi label="Custo total" value={formatCurrency(totals.totalCost)} />
            <Kpi
              label="Lucro"
              value={formatCurrency(totals.profit)}
              hint={`Margem ${totals.realMargin === null ? "—" : formatPercent(totals.realMargin)} · meta ${formatPercent(totals.desiredMargin)}`}
            />
            <Kpi label="Horas apontadas" value={formatHours(totals.hours)} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi label="Horas apontadas" value={formatHours(totals.hours)} />
            <Kpi
              label="Horas faturáveis"
              value={formatHours(totals.billableHours)}
              hint={`de ${formatHours(totals.hours)} apontadas`}
            />
            <Kpi
              label="Contratos com movimento"
              value={String(report.contracts.length)}
              hint="no mês vigente"
            />
          </div>
        )}

        {report.contracts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {(Object.keys(byStatus) as HealthStatus[]).map((status) =>
              byStatus[status] > 0 ? (
                <span key={status} className="flex items-center gap-1.5 text-sm">
                  <StatusBadge status={status} />
                  <span className="text-muted-foreground">
                    {byStatus[status]} {byStatus[status] === 1 ? "contrato" : "contratos"}
                  </span>
                </span>
              ) : null,
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum contrato com movimento no período.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CollaboratorSummary({
  monthlyHours,
  isCustomHours,
  entries,
  leaves,
  today,
  projection,
}: {
  monthlyHours: number;
  isCustomHours: boolean;
  entries: HeatmapRawEntry[];
  leaves: HeatmapRawLeave[];
  today: string;
  projection: SalaryProjection | null;
}) {
  const hoursLogged = projection?.hoursLogged ?? 0;
  const targetHours = projection?.targetHours ?? monthlyHours;
  const leaveHours = projection?.leaveHours ?? 0;
  const leaveDaysCount = projection?.leaveDaysCount ?? 0;
  const hoursRemaining = projection?.hoursRemaining ?? Math.max(0, targetHours - hoursLogged);
  const progressPercent = projection?.progressPercent ?? 0;

  return (
    <div className="grid gap-6">
      {/* Cards de Métricas Principais: Jornada e Previsão Salarial */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Card 1: Horas Contratadas, Apontadas e Restantes */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Sua jornada no mês</CardTitle>
              <div className="flex items-center gap-1.5">
                {leaveHours > 0 && (
                  <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs px-2.5 py-0.5 font-medium">
                    Férias/Recesso aplicado
                  </span>
                )}
                {isCustomHours && (
                  <span className="rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-0.5 font-medium">
                    Jornada individual
                  </span>
                )}
              </div>
            </div>
            <CardDescription className="text-xs">
              Acompanhamento de horas realizadas e saldo restante no mês.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-semibold tabular-nums">
                  {formatHours(hoursLogged)}
                </span>
                <span className="text-xs text-muted-foreground ml-1.5">apontadas</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-foreground">
                  de {formatHours(targetHours)} a trabalhar
                </span>
                {leaveHours > 0 ? (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    🏖️ -{formatHours(leaveHours)} ({leaveDaysCount}d férias/recesso)
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    de {formatHours(monthlyHours)} contratadas
                  </p>
                )}
              </div>
            </div>

            {/* Barra de Progresso Visual */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressPercent.toFixed(1)}% cumprido</span>
                <span className="font-semibold text-foreground">
                  {hoursRemaining > 0 ? `${formatHours(hoursRemaining)} restantes a trabalhar` : "Meta cumprida!"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button nativeButton={false} render={<Link href="/apontamentos" />} size="sm">
                Lançar horas
                <ArrowRightIcon className="size-3.5" />
              </Button>
              <Button nativeButton={false} render={<Link href="/minhas-analises" />} variant="outline" size="sm">
                Minhas análises
                <ArrowRightIcon className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Ausências e Regularidade */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Ausências e regularidade</CardTitle>
              <span className="rounded-full bg-muted text-muted-foreground text-xs px-2.5 py-0.5 font-medium">
                Mês atual
              </span>
            </div>
            <CardDescription className="text-xs">
              Acompanhamento de férias, recessos e faltas registradas no mês.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-3 space-y-2 text-xs bg-muted/30">
              {projection && projection.absenceDaysCount > 0 ? (
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <CalendarX2Icon className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      {projection.absenceDaysCount} {projection.absenceDaysCount === 1 ? "falta registrada" : "faltas registradas"} no mês
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Faltas não justificadas impactam o fechamento da sua jornada.
                    </p>
                  </div>
                </div>
              ) : leaveDaysCount > 0 ? (
                <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      {leaveDaysCount} {leaveDaysCount === 1 ? "dia útil" : "dias úteis"} em férias/recesso
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Sua jornada esperada a cumprir no mês foi ajustada para {formatHours(targetHours)}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Regularidade em dia</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Nenhuma ausência pendente ou falta registrada neste mês.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Precisa registrar um período de férias, descanso, folga ou atestado? Use o botão abaixo para manter seus registros alinhados.
            </p>

            <div className="pt-1">
              <LeavesDialog
                currentLeaves={leaves as LeaveRecord[]}
                triggerText="Informar férias / falta / recesso"
                triggerVariant="outline"
                triggerClassName="h-8 text-xs font-medium w-full sm:w-auto"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Sua atividade e apontamentos</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus dias apontados, horas registradas e clientes atendidos.
          </p>
        </div>
        <ActivityHeatmap
          entries={entries}
          leaves={leaves}
          today={today}
          monthlyHours={monthlyHours}
        />
      </div>
    </div>
  );
}
