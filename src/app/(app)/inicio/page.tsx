import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarX2Icon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  UserXIcon,
} from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { requireContext, ROLE_LABELS } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatHours, formatPercent, todayISO } from "@/lib/format";
import { addDays, businessDaysBetween, endOfMonth, startOfMonth } from "@/lib/time";
import { resolvePeriod } from "@/lib/periods";
import { getEmployeeMetrics, getProfitabilityReport } from "@/lib/server/metrics";
import { calculateSalaryProjection, type SalaryProjection } from "@/lib/salary-projection";
import type { HealthStatus } from "@/lib/profitability";
import type { HeatmapRawEntry, HeatmapRawLeave } from "@/lib/heatmap";
import { LeavesDialog, type LeaveRecord } from "../minhas-analises/leaves-dialog";
import { ActivityHeatmap } from "./activity-heatmap";

export const metadata = { title: "Início | Apontamento" };

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ferias: "Férias",
  recesso: "Recesso",
  falta: "Falta",
  atestado: "Atestado",
  folga: "Folga",
  outro: "Outro",
};

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
          <ManagerDailyRadar today={today} />
          <ManagerSummary canSeeCosts={canSeeCosts} />
          {employeeId && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-semibold tracking-tight">Seus apontamentos pessoais</h2>
                  <InfoTooltip text="Seus dias apontados e horas registradas por cliente." />
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
    </div>
  );
}

/** Radar operacional do dia para gestores e administradores. */
async function ManagerDailyRadar({ today }: { today: string }) {
  const period = resolvePeriod(today);
  const weekAhead = addDays(today, 7);
  const supabase = await createClient();

  const [pendingRes, deletionRes, upcomingLeavesRes, employeeMetrics] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente"),
    supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .not("deletion_requested_at", "is", null),
    supabase
      .from("employee_leaves")
      .select("id, employee_id, start_date, end_date, type, employees(full_name, active)")
      .lte("start_date", weekAhead)
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
    getEmployeeMetrics(period),
  ]);

  const pendingCount = pendingRes.count ?? 0;
  const deletionCount = deletionRes.count ?? 0;
  const totalApprovals = pendingCount + deletionCount;

  const activeLeaves = (upcomingLeavesRes.data ?? [])
    .map((row) => {
      const emp = row.employees as unknown as { full_name: string; active: boolean } | null;
      return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: emp?.full_name ?? "Colaborador",
        employeeActive: emp?.active ?? true,
        startDate: row.start_date,
        endDate: row.end_date,
        type: row.type,
      };
    })
    .filter((l) => l.employeeActive);

  const onLeaveTodayIds = new Set(
    activeLeaves
      .filter((l) => l.startDate <= today && l.endDate >= today)
      .map((l) => l.employeeId),
  );

  const overdueEmployees = employeeMetrics
    .filter((emp) => emp.active && emp.last_entry_date && !onLeaveTodayIds.has(emp.employee_id))
    .map((emp) => {
      const idleDays = businessDaysBetween(emp.last_entry_date!, today) - 1;
      return {
        id: emp.employee_id,
        name: emp.employee_name,
        lastEntryDate: emp.last_entry_date!,
        idleDays,
      };
    })
    .filter((emp) => emp.idleDays > 2)
    .sort((a, b) => b.idleDays - a.idleDays);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Bloco 1: Aprovações Pendentes */}
      <Card className={totalApprovals > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheckIcon className="size-4 text-primary" />
              Aprovações pendentes
            </CardTitle>
            {totalApprovals > 0 ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" variant="outline">
                {totalApprovals}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                Em dia
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {totalApprovals === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum apontamento ou pedido de exclusão aguardando análise.
            </p>
          ) : (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                <strong className="font-semibold text-foreground">{pendingCount}</strong>{" "}
                {pendingCount === 1 ? "apontamento para aprovar" : "apontamentos para aprovar"}
              </p>
              <p>
                <strong className="font-semibold text-foreground">{deletionCount}</strong>{" "}
                {deletionCount === 1 ? "solicitação de exclusão" : "solicitações de exclusão"}
              </p>
            </div>
          )}
          <Button
            nativeButton={false}
            render={<Link href="/aprovacoes" />}
            variant={totalApprovals > 0 ? "default" : "outline"}
            size="sm"
            className="w-full justify-between"
          >
            {totalApprovals > 0 ? "Revisar pendências" : "Abrir aprovações"}
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </CardContent>
      </Card>

      {/* Bloco 2: Equipe sem apontar (>2 dias úteis) */}
      <Card className={overdueEmployees.length > 0 ? "border-orange-500/30 bg-orange-500/5" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserXIcon className="size-4 text-orange-600 dark:text-orange-400" />
                Sem apontar (+2d)
              </CardTitle>
              <InfoTooltip text="Colaboradores ativos (fora de férias/ausência hoje) com mais de 2 dias úteis desde o último apontamento." />
            </div>
            <Badge variant={overdueEmployees.length > 0 ? "secondary" : "outline"}>
              {overdueEmployees.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {overdueEmployees.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Toda a equipe ativa registrou apontamentos recentemente.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {overdueEmployees.slice(0, 3).map((emp) => (
                <li key={emp.id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-foreground">{emp.name}</span>
                  <span className="shrink-0 text-orange-700 dark:text-orange-400 font-medium tabular-nums">
                    {emp.idleDays}d úteis
                  </span>
                </li>
              ))}
              {overdueEmployees.length > 3 ? (
                <li className="text-[11px] text-muted-foreground">
                  + {overdueEmployees.length - 3} colaborador(es)
                </li>
              ) : null}
            </ul>
          )}
          <Button
            nativeButton={false}
            render={<Link href="/dashboard?aba=equipe" />}
            variant="outline"
            size="sm"
            className="w-full justify-between"
          >
            Ver equipe no painel
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </CardContent>
      </Card>

      {/* Bloco 3: Férias e Ausências (hoje e próximos 7 dias) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClockIcon className="size-4 text-blue-600 dark:text-blue-400" />
                Férias & ausências
              </CardTitle>
              <InfoTooltip text="Afastamentos vigentes hoje ou previstos para os próximos 7 dias." />
            </div>
            <Badge variant="outline">{activeLeaves.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {activeLeaves.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma ausência ou férias registrada para os próximos 7 dias.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {activeLeaves.slice(0, 3).map((leave) => {
                const isToday = leave.startDate <= today && leave.endDate >= today;
                return (
                  <li key={leave.id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{leave.employeeName}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {LEAVE_TYPE_LABELS[leave.type] ?? leave.type} ·{" "}
                      {isToday ? (
                        <strong className="text-blue-600 dark:text-blue-400">Hoje</strong>
                      ) : (
                        formatDate(leave.startDate)
                      )}
                    </span>
                  </li>
                );
              })}
              {activeLeaves.length > 3 ? (
                <li className="text-[11px] text-muted-foreground">
                  + {activeLeaves.length - 3} ausência(s) na semana
                </li>
              ) : null}
            </ul>
          )}
          <Button
            nativeButton={false}
            render={<Link href="/colaboradores" />}
            variant="outline"
            size="sm"
            className="w-full justify-between"
          >
            Gerenciar equipe
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </CardContent>
      </Card>
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
          showBillable={false}
        />
      </div>
    </div>
  );
}
