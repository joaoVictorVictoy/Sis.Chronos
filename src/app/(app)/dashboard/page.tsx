import Link from "next/link";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ExportMenu } from "@/components/export-menu";
import { InfoTooltip } from "@/components/info-tooltip";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency, formatHours, formatPercent, todayISO } from "@/lib/format";
import { monthsInRange, resolvePeriod } from "@/lib/periods";
import { buildAlerts } from "@/lib/alerts";
import { HEALTH_LABELS, type HealthStatus } from "@/lib/profitability";
import {
  getActivityMetrics,
  getAreaReport,
  getClientHoursReport,
  getEmployeeClientCost,
  getEmployeeMetrics,
  getMissingCosts,
  getMonthlyEvolution,
  getPendingApprovalsCount,
  getProfitabilityReport,
  getTeamOperationalReport,
} from "@/lib/server/metrics";
import { getChurnReport } from "@/lib/server/churn";
import { BarList, MarginEvolutionChart, MonthlyResultChart, RevenueMarginScatter } from "./charts";
import { ChurnAnalysisCard } from "./churn-analysis";
import { ClientsPanel, type PanelItem } from "./clients-panel";
import { PeriodFilter } from "./period-filter";
import { TeamOperationalView } from "./team-operational-view";
import { DashboardViewTabs, type DashboardTab } from "./dashboard-view-tabs";
import { DashboardAlerts } from "./dashboard-alerts";

export const metadata = { title: "Rentabilidade | Apontamento" };

function Kpi({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {children}
      </CardHeader>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const { profile } = await requireRole(["admin", "gestor"]);
  const isAdmin = profile.role === "admin";
  const canSeeCosts = isAdmin || profile.can_view_costs;

  const rawAba = typeof params.aba === "string" ? params.aba : undefined;
  const initialTab: DashboardTab =
    rawAba === "cliente" || rawAba === "horas-cliente"
      ? "horas-cliente"
      : rawAba === "equipe"
      ? "equipe"
      : rawAba === "churn" && canSeeCosts
      ? "churn"
      : "rentabilidade";
  const initialClientId = typeof params.cliente === "string" ? params.cliente : undefined;

  const today = todayISO();
  const period = resolvePeriod(today, {
    periodo: typeof params.periodo === "string" ? params.periodo : undefined,
    de: typeof params.de === "string" ? params.de : undefined,
    ate: typeof params.ate === "string" ? params.ate : undefined,
  });

  const report = await getProfitabilityReport(period);
  const [
    employees,
    missingCosts,
    pendingCount,
    areas,
    activities,
    employeeClients,
    evolution,
    teamOperationalReport,
    churnReport,
    clientHoursReport,
  ] = await Promise.all([
    getEmployeeMetrics(period),
    getMissingCosts(),
    getPendingApprovalsCount(),
    getAreaReport(period, report.contracts),
    getActivityMetrics(period),
    getEmployeeClientCost(period),
    getMonthlyEvolution(monthsInRange(monthsBack(period.from, 5), period.to)),
    getTeamOperationalReport(period),
    getChurnReport(period),
    getClientHoursReport(period),
  ]);

  const totals = report.totals;
  const alerts = buildAlerts({
    contracts: report.contracts,
    employees: employees.map((e) => ({
      employee_id: e.employee_id,
      employee_name: e.employee_name,
      hours: Number(e.hours),
      last_entry_date: e.last_entry_date,
    })),
    missingCosts: canSeeCosts ? missingCosts : [],
    pendingCount,
    today,
    canManageContracts: isAdmin,
  });

  const byStatus = report.contracts.reduce<Record<HealthStatus, number>>(
    (acc, item) => {
      acc[item.profitability.status] += 1;
      return acc;
    },
    { saudavel: 0, atencao: 0, critico: 0 },
  );

  const panelItems: PanelItem[] = report.contracts.map(({ row, profitability }) => ({
    contractId: row.contract_id,
    clientId: row.client_id,
    clientName: row.client_name,
    contractName: row.contract_name,
    periodicity: row.periodicity,
    revenue: profitability.netRevenue,
    cost: profitability.totalCost,
    profit: profitability.profit,
    margin: profitability.realMargin,
    desiredMargin: profitability.desiredMargin,
    hours: profitability.hours,
    hoursLimit: profitability.hoursLimit,
    consumption: profitability.hoursConsumption,
    status: profitability.status,
  }));

  const scatter = report.contracts
    .filter((c) => c.profitability.realMargin !== null)
    .map((c) => ({
      name: c.row.client_name,
      revenue: c.profitability.netRevenue,
      marginPct: (c.profitability.realMargin ?? 0) * 100,
      desiredPct: c.profitability.desiredMargin * 100,
      status: c.profitability.status,
    }));

  const ranking = [...report.contracts].sort((a, b) => b.profitability.profit - a.profitability.profit);
  const worstMargin = [...report.contracts]
    .filter((c) => c.profitability.realMargin !== null)
    .sort((a, b) => (a.profitability.realMargin ?? 0) - (b.profitability.realMargin ?? 0));

  const totalHours = employees.reduce((sum, e) => sum + Number(e.hours), 0);
  const availableHours = employees.reduce((sum, e) => sum + Number(e.available_hours), 0);
  const billableShare = totals.hours > 0 ? totals.billableHours / totals.hours : 0;

  // Concentração: participação dos 3 maiores clientes na receita
  const revenueByClient = new Map<string, number>();
  for (const { row, profitability } of report.contracts) {
    revenueByClient.set(row.client_name, (revenueByClient.get(row.client_name) ?? 0) + profitability.netRevenue);
  }
  const topClients = [...revenueByClient.entries()].sort((a, b) => b[1] - a[1]);
  const concentration =
    totals.netRevenue > 0 ? topClients.slice(0, 3).reduce((sum, [, v]) => sum + v, 0) / totals.netRevenue : 0;

  const adjustments = report.contracts
    .filter((c) => c.adjustment !== null && c.adjustment > 0.01)
    .sort((a, b) => (b.adjustment ?? 0) - (a.adjustment ?? 0))
    .slice(0, 6);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={canSeeCosts ? "Rentabilidade" : "Visão Operacional"}
        description={`${period.label} · ${report.contracts.length} contrato(s)`}
      >
        <div className="flex flex-wrap gap-2">
          {canSeeCosts ? <ExportMenu dataset="rentabilidade" label="Exportar rentabilidade" /> : null}
          <ExportMenu dataset="apontamentos" label="Apontamentos" scope="todos" />
          <ExportMenu dataset="equipe" label="Equipe" />
        </div>
      </PageHeader>

      <PeriodFilter preset={period.preset} from={period.from} to={period.to} />

      <DashboardViewTabs
        initialTab={initialTab}
        initialClientId={initialClientId}
        clientHoursReport={clientHoursReport}
        canSeeCosts={canSeeCosts}
        overviewContent={
          <>
            <DashboardAlerts alerts={alerts} />

            {canSeeCosts ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Receita líquida"
                  value={formatCurrency(totals.netRevenue)}
                  hint={`Bruta ${formatCurrency(totals.revenue)} · impostos ${formatCurrency(totals.taxAmount)}`}
                />
                <Kpi
                  label="Custo total"
                  value={formatCurrency(totals.totalCost)}
                  hint={`Horas ${formatCurrency(totals.laborCost)} · extras ${formatCurrency(totals.expenseCost)}`}
                />
                <Kpi label="Lucro" value={formatCurrency(totals.profit)}>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {(totals.marginGapPoints ?? 0) >= 0 ? (
                      <TrendingUpIcon className="size-3 text-[--viz-good]" />
                    ) : (
                      <TrendingDownIcon className="size-3 text-[--viz-critical]" />
                    )}
                    Margem {totals.realMargin === null ? "—" : formatPercent(totals.realMargin)} · meta{" "}
                    {formatPercent(totals.desiredMargin)}
                  </p>
                </Kpi>
                <Kpi
                  label="Horas apontadas"
                  value={formatHours(totals.hours)}
                  hint={`${formatPercent(billableShare)} faturáveis · valor hora ${
                    totals.effectiveHourlyRate === null ? "—" : formatCurrency(totals.effectiveHourlyRate)
                  }`}
                >
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(Object.keys(byStatus) as HealthStatus[]).map((status) =>
                      byStatus[status] > 0 ? (
                        <span key={status} className="flex items-center gap-1">
                          <StatusBadge status={status} />
                          <span className="text-xs text-muted-foreground">
                            {byStatus[status]} {byStatus[status] === 1 ? "contrato" : "contratos"}
                          </span>
                        </span>
                      ) : null,
                    )}
                  </div>
                </Kpi>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Total de Horas Apontadas"
                  value={formatHours(totals.hours)}
                  hint={`${formatPercent(billableShare)} faturáveis`}
                />
                <Kpi
                  label="Horas Faturáveis"
                  value={formatHours(totals.billableHours)}
                  hint={`de ${formatHours(totals.hours)} apontadas`}
                />
                <Kpi
                  label="Utilização da Equipe"
                  value={availableHours > 0 ? formatPercent(totalHours / availableHours) : "—"}
                  hint={`${formatHours(totalHours)} de ${formatHours(availableHours)} disponíveis`}
                />
                <Kpi
                  label="Contratos com Movimento"
                  value={String(report.contracts.length)}
                  hint="no período selecionado"
                >
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(Object.keys(byStatus) as HealthStatus[]).map((status) =>
                      byStatus[status] > 0 ? (
                        <span key={status} className="flex items-center gap-1">
                          <StatusBadge status={status} />
                          <span className="text-xs text-muted-foreground">
                            {byStatus[status]} {byStatus[status] === 1 ? "contrato" : "contratos"}
                          </span>
                        </span>
                      ) : null,
                    )}
                  </div>
                </Kpi>
              </div>
            )}

            <ClientsPanel items={panelItems} canSeeCosts={canSeeCosts} canManageContracts={isAdmin} />

            {canSeeCosts ? (
              <>
                <div className="grid gap-6 xl:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                      <CardTitle>Mais rentáveis</CardTitle>
                      <InfoTooltip side="right" text="Maior lucro no período." />
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {ranking.slice(0, 5).map(({ row, profitability }) => {
                        const inner = (
                          <>
                            <span className="min-w-0 truncate font-medium">{row.client_name}</span>
                            <span className="shrink-0 tabular-nums font-medium">{formatCurrency(profitability.profit)}</span>
                          </>
                        );
                        return isAdmin ? (
                          <Link
                            key={row.contract_id}
                            href={`/contratos/${row.contract_id}`}
                            className="flex min-w-0 items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                            title={row.client_name}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div
                            key={row.contract_id}
                            className="flex min-w-0 items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-sm"
                            title={row.client_name}
                          >
                            {inner}
                          </div>
                        );
                      })}
                      {ranking.length === 0 ? <EmptyState>Sem dados.</EmptyState> : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                      <CardTitle>Menores margens</CardTitle>
                      <InfoTooltip side="right" text="Onde a meta está mais longe." />
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {worstMargin.slice(0, 5).map(({ row, profitability }) => {
                        const inner = (
                          <>
                            <span className="min-w-0 truncate font-medium">{row.client_name}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="tabular-nums font-medium">{formatPercent(profitability.realMargin ?? 0)}</span>
                              <StatusBadge status={profitability.status} />
                            </span>
                          </>
                        );
                        return isAdmin ? (
                          <Link
                            key={row.contract_id}
                            href={`/contratos/${row.contract_id}`}
                            className="flex min-w-0 items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                            title={row.client_name}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div
                            key={row.contract_id}
                            className="flex min-w-0 items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-sm"
                            title={row.client_name}
                          >
                            {inner}
                          </div>
                        );
                      })}
                      {worstMargin.length === 0 ? <EmptyState>Sem dados.</EmptyState> : null}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                      <CardTitle>Sugestão de reajuste</CardTitle>
                      <InfoTooltip side="right" text="Aumento necessário para atingir a margem desejada." />
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      {adjustments.map(({ row, adjustment, profitability }) => {
                        const inner = (
                          <>
                            <span className="flex min-w-0 items-center justify-between gap-2.5">
                              <span className="min-w-0 truncate font-medium">{row.client_name}</span>
                              <span className="shrink-0 tabular-nums font-medium">+{formatPercent(adjustment ?? 0)}</span>
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              De {formatCurrency(profitability.revenue)} para{" "}
                              {formatCurrency(profitability.revenue * (1 + (adjustment ?? 0)))} no período
                            </span>
                          </>
                        );
                        return isAdmin ? (
                          <Link
                            key={row.contract_id}
                            href={`/contratos/${row.contract_id}`}
                            className="grid min-w-0 gap-0.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                            title={row.client_name}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div
                            key={row.contract_id}
                            className="grid min-w-0 gap-0.5 rounded-lg border px-3 py-2 text-sm"
                            title={row.client_name}
                          >
                            {inner}
                          </div>
                        );
                      })}
                      {adjustments.length === 0 ? (
                        <EmptyState>Todos os contratos já cobrem a margem desejada.</EmptyState>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                      <CardTitle>Evolução mensal</CardTitle>
                      <InfoTooltip side="right" text="Receita líquida, custo total e lucro nos últimos meses." />
                    </CardHeader>
                    <CardContent>
                      <MonthlyResultChart data={evolution} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                      <CardTitle>Margem da empresa</CardTitle>
                      <InfoTooltip side="right" text="Margem real contra a meta ponderada pelos contratos." />
                    </CardHeader>
                    <CardContent>
                      <MarginEvolutionChart data={evolution} />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-2">
                    <CardTitle>Receita × margem</CardTitle>
                    <InfoTooltip
                      side="right"
                      text="Quadrante inferior direito = cliente grande com margem baixa: é onde renegociar primeiro."
                    />
                  </CardHeader>
                  <CardContent>
                    {scatter.length === 0 ? (
                      <EmptyState>Sem contratos com receita no período.</EmptyState>
                    ) : (
                      <RevenueMarginScatter data={scatter} targetPct={totals.desiredMargin * 100} />
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center gap-2">
                      <CardTitle>Rentabilidade por área</CardTitle>
                      <InfoTooltip side="right" text="Receita rateada pelas horas apontadas em cada área." />
                    </CardHeader>
                    <CardContent>
                      {areas.length === 0 ? (
                        <EmptyState>Sem horas apontadas no período.</EmptyState>
                      ) : (
                        <BarList
                          items={areas.map((area) => ({
                            id: area.id,
                            label: area.name,
                            value: area.profit,
                            hint: `${formatHours(area.hours)} · margem ${area.margin === null ? "—" : formatPercent(area.margin)}`,
                          }))}
                          format="currency"
                        />
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Concentração de receita</CardTitle>
                      <CardDescription>
                        Os 3 maiores clientes representam {formatPercent(concentration)} da receita líquida do período.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {topClients.length === 0 ? (
                        <EmptyState>Sem receita no período.</EmptyState>
                      ) : (
                        <BarList
                          items={topClients.slice(0, 8).map(([name, value]) => ({
                            id: name,
                            label: name,
                            value,
                            hint: totals.netRevenue > 0 ? formatPercent(value / totals.netRevenue) : undefined,
                          }))}
                          format="currency"
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Critérios de status</span>
                  <InfoTooltip
                    side="right"
                    text={`🟢 ${HEALTH_LABELS.saudavel} (margem real igual ou acima da meta) · 🟡 ${HEALTH_LABELS.atencao} (até ${report.tolerance} pontos percentuais abaixo da meta) · 🔴 ${HEALTH_LABELS.critico} (mais do que isso abaixo, ou prejuízo). Ajuste esse limite em Configurações → Empresa.`}
                  />
                </div>
              </>
            ) : null}
          </>
        }
        teamContent={
          <>
            <TeamOperationalView report={teamOperationalReport} canSeeCosts={canSeeCosts} />

            {canSeeCosts ? (
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2">
                    <CardTitle>Maior custo alocado por cliente</CardTitle>
                    <InfoTooltip side="right" text="Quem está consumindo a margem de cada cliente." />
                  </CardHeader>
                  <CardContent>
                    {employeeClients.length === 0 ? (
                      <EmptyState>Sem horas apontadas em contratos.</EmptyState>
                    ) : (
                      <BarList
                        items={employeeClients.slice(0, 8).map((e) => ({
                          id: `${e.employee_id}-${e.client_id}`,
                          label: `${e.employee_name} → ${e.client_name}`,
                          value: Number(e.labor_cost),
                          hint: formatHours(Number(e.hours)),
                        }))}
                        format="currency"
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-2">
                    <CardTitle>Custo por atividade</CardTitle>
                    <InfoTooltip side="right" text="Quais atividades mais consomem margem." />
                  </CardHeader>
                  <CardContent>
                    {activities.length === 0 ? (
                      <EmptyState>Sem horas apontadas no período.</EmptyState>
                    ) : (
                      <BarList
                        items={activities.slice(0, 8).map((a) => ({
                          id: a.activity_id,
                          label: a.activity_name,
                          value: Number(a.labor_cost),
                          hint: `${formatHours(Number(a.hours))} · ${a.billable ? "faturável" : "não faturável"} · ${a.area_name}`,
                        }))}
                        format="currency"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </>
        }
        churnContent={
          canSeeCosts ? (
            <ChurnAnalysisCard report={churnReport} canManageContracts={isAdmin} />
          ) : undefined
        }
      />
    </div>
  );
}

/** Primeiro dia do mês, `count` meses antes da data informada. */
function monthsBack(iso: string, count: number): string {
  const [year, month] = iso.split("-").map(Number);
  const total = year * 12 + (month - 1) - count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}
