import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { requireContext, ROLE_LABELS } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatHours, formatPercent, todayISO } from "@/lib/format";
import { addDays } from "@/lib/time";
import { resolvePeriod } from "@/lib/periods";
import { getProfitabilityReport } from "@/lib/server/metrics";
import type { HealthStatus } from "@/lib/profitability";
import type { HeatmapRawEntry, HeatmapRawLeave } from "@/lib/heatmap";
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
  const { profile, tenant, employeeId } = await requireContext();
  const isManager = profile.role === "admin" || profile.role === "gestor";
  const canSeeCosts = profile.role === "admin" || profile.can_view_costs;

  const today = todayISO();
  let rawEntries: HeatmapRawEntry[] = [];
  let rawLeaves: HeatmapRawLeave[] = [];

  if (employeeId) {
    const fromDate = addDays(today, -150);
    const supabase = await createClient();
    const [{ data: breakdownData }, { data: leavesData }] = await Promise.all([
      supabase.rpc("my_hours_breakdown", { p_from: fromDate, p_to: today }),
      supabase
        .from("employee_leaves")
        .select("start_date, end_date, type, notes")
        .eq("employee_id", employeeId)
        .lte("start_date", today)
        .gte("end_date", fromDate),
    ]);
    rawEntries = (breakdownData ?? []) as HeatmapRawEntry[];
    rawLeaves = (leavesData ?? []) as HeatmapRawLeave[];
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
                monthlyHours={Number(tenant.monthly_hours)}
              />
            </div>
          )}
        </>
      ) : (
        <CollaboratorSummary
          monthlyHours={Number(tenant.monthly_hours)}
          entries={rawEntries}
          leaves={rawLeaves}
          today={today}
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
  entries,
  leaves,
  today,
}: {
  monthlyHours: number;
  entries: HeatmapRawEntry[];
  leaves: HeatmapRawLeave[];
  today: string;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Sua atividade e apontamentos</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus dias apontados, horas registradas e clientes atendidos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button nativeButton={false} render={<Link href="/apontamentos" />}>
            Lançar horas
            <ArrowRightIcon />
          </Button>
          <Button nativeButton={false} render={<Link href="/minhas-analises" />} variant="outline">
            Minhas análises
            <ArrowRightIcon />
          </Button>
        </div>
      </div>

      <ActivityHeatmap
        entries={entries}
        leaves={leaves}
        today={today}
        monthlyHours={monthlyHours}
      />
    </div>
  );
}
