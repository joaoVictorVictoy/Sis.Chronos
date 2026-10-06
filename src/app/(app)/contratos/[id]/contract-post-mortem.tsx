import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PercentIcon,
  ScaleIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency, formatDate, formatHours, formatPercent, todayISO } from "@/lib/format";
import type { Tables } from "@/lib/database.types";
import type { ContractMetricsRow } from "@/lib/profitability";

export async function ContractPostMortemCard({
  contract,
}: {
  contract: Tables<"contracts"> & {
    clients: Pick<Tables<"clients">, "id" | "legal_name" | "trade_name">;
  };
}) {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();

  const cutoffDate = contract.terminated_at || contract.end_date || todayISO();
  const startDate = contract.start_date;

  // Busca as métricas consolidadas de todo o ciclo de vida do contrato
  const [{ data: metrics }, { data: breakdown }] = await Promise.all([
    supabase.rpc("contract_metrics", { p_from: startDate, p_to: cutoffDate }),
    supabase.rpc("contract_hours_breakdown", {
      p_contract_id: contract.id,
      p_from: startDate,
      p_to: cutoffDate,
    }),
  ]);

  const row = ((metrics ?? []) as ContractMetricsRow[]).find((m) => m.contract_id === contract.id);

  const penalty = Number(contract.termination_penalty) || 0;
  const rawRevenue = Number(row?.revenue) || 0;
  // Se a query no banco já incluir a multa (via private.contract_revenue atualizada):
  const regularRevenue = rawRevenue >= penalty ? rawRevenue - penalty : rawRevenue;
  const grossRevenue = regularRevenue + penalty;

  const taxRate = Number(contract.tax_rate) || 0;
  const taxFraction = taxRate / 100;
  const taxAmount = grossRevenue * taxFraction;
  const netRevenue = grossRevenue - taxAmount;

  const laborCost = Number(row?.labor_cost) || 0;
  const expenseCost = Number(row?.expense_cost) || 0;
  const totalCost = laborCost + expenseCost;

  const profit = netRevenue - totalCost;
  const realMargin = netRevenue > 0 ? profit / netRevenue : null;
  const desiredMargin = (Number(contract.desired_margin) || 0) / 100;
  const marginGapPoints = realMargin !== null ? (realMargin - desiredMargin) * 100 : null;

  const hours = Number(row?.hours) || 0;
  const billableHours = Number(row?.billable_hours) || 0;
  const entriesCount = Number(row?.entries_count) || 0;
  const effectiveHourlyRate = hours > 0 ? netRevenue / hours : null;

  // Veredito objetivo: lucrativo ou prejuízo
  const isProfitable = profit > 0;
  const isBreakeven = Math.abs(profit) < 0.01;
  const metTarget = isProfitable && realMargin !== null && realMargin >= desiredMargin;

  let verdictTitle = "Contrato com Prejuízo";
  let verdictBadgeVariant: "destructive" | "default" | "secondary" = "destructive";
  let verdictColorClass = "text-rose-600 dark:text-rose-400";
  let verdictBorderClass = "border-rose-500/30 bg-rose-500/5";
  let VerdictIcon = XCircleIcon;

  if (metTarget) {
    verdictTitle = "Contrato Lucrativo (Superou a Meta)";
    verdictBadgeVariant = "default";
    verdictColorClass = "text-emerald-600 dark:text-emerald-400";
    verdictBorderClass = "border-emerald-500/30 bg-emerald-500/5";
    VerdictIcon = CheckCircle2Icon;
  } else if (isProfitable) {
    verdictTitle = "Lucrativo com Margem Abaixo da Meta";
    verdictBadgeVariant = "secondary";
    verdictColorClass = "text-amber-600 dark:text-amber-400";
    verdictBorderClass = "border-amber-500/30 bg-amber-500/5";
    VerdictIcon = AlertTriangleIcon;
  } else if (isBreakeven) {
    verdictTitle = "Empate Financeiro";
    verdictBadgeVariant = "secondary";
    verdictColorClass = "text-muted-foreground";
    verdictBorderClass = "border-muted bg-muted/20";
    VerdictIcon = ScaleIcon;
  }

  // URL para exportação do balanço completo do ciclo de vida
  const exportHref = (format: string) => {
    const search = new URLSearchParams({
      periodo: "personalizado",
      de: startDate,
      ate: cutoffDate,
      formato: format,
    });
    return `/exportar/rentabilidade?${search.toString()}`;
  };

  const topEmployees = [...(breakdown ?? [])]
    .sort((a, b) => Number(b.hours) - Number(a.hours))
    .slice(0, 3);

  return (
    <Card className={`border-2 ${verdictBorderClass} shadow-xs`}>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-4">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Fechamento do Ciclo de Vida
            </span>
            <Badge variant={verdictBadgeVariant} className="gap-1 font-semibold text-xs py-0.5 px-2.5">
              <VerdictIcon className="size-3.5" />
              {verdictTitle}
            </Badge>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            Relatório Post-Mortem de Rentabilidade
          </CardTitle>
          <CardDescription className="text-sm">
            Balanço consolidado desde o início da vigência ({formatDate(startDate)}) até o encerramento ({formatDate(cutoffDate)}).
          </CardDescription>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-2 shrink-0 self-start">
                <DownloadIcon className="size-4" />
                Exportar balanço final
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Baixar relatório do ciclo de vida</DropdownMenuLabel>
            <DropdownMenuItem render={<a href={exportHref("csv")} download />}>
              <DownloadIcon className="size-4" />
              CSV (Excel simples)
            </DropdownMenuItem>
            <DropdownMenuItem render={<a href={exportHref("xlsx")} download />}>
              <FileSpreadsheetIcon className="size-4" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem render={<a href={exportHref("pdf")} download />}>
              <FileTextIcon className="size-4" />
              PDF consolidado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="grid gap-6">
        {/* 4 Blocos Principais */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Faturamento Total */}
          <div className="rounded-xl border bg-card p-4 grid gap-1 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Faturamento Bruto</span>
              <span className="font-mono text-[10px] uppercase">Receita</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {formatCurrency(grossRevenue)}
            </p>
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {penalty > 0 ? (
                <>
                  <p>
                    Regular: <span className="font-medium text-foreground">{formatCurrency(regularRevenue)}</span>
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                    + Multa rescisória: {formatCurrency(penalty)}
                  </p>
                </>
              ) : null}
              <p>
                Líquida de impostos:{" "}
                <strong className="text-foreground">{formatCurrency(netRevenue)}</strong>{" "}
                {taxRate > 0 ? `(${taxRate}% imp.)` : ""}
              </p>
            </div>
          </div>

          {/* 2. Custo Total */}
          <div className="rounded-xl border bg-card p-4 grid gap-1 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Custo Total Consumido</span>
              <span className="font-mono text-[10px] uppercase">Operação</span>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(totalCost)}
            </p>
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <p>
                Horas equipe ({formatHours(hours)}):{" "}
                <span className="font-medium text-foreground">{formatCurrency(laborCost)}</span>
              </p>
              <p>
                Gastos extras:{" "}
                <span className="font-medium text-foreground">{formatCurrency(expenseCost)}</span>
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                {entriesCount} apontamento(s) ao todo
              </p>
            </div>
          </div>

          {/* 3. Lucro Líquido Final */}
          <div className="rounded-xl border bg-card p-4 grid gap-1 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Lucro Líquido Final</span>
              {profit >= 0 ? (
                <TrendingUpIcon className="size-4 text-emerald-500" />
              ) : (
                <TrendingDownIcon className="size-4 text-rose-500" />
              )}
            </div>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${verdictColorClass}`}>
              {formatCurrency(profit)}
            </p>
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <p>
                Resultado líquido após impostos e custos operacionais.
              </p>
              {effectiveHourlyRate !== null ? (
                <p>
                  Valor hora efetivo:{" "}
                  <strong className="text-foreground">{formatCurrency(effectiveHourlyRate)}/h</strong>
                </p>
              ) : null}
            </div>
          </div>

          {/* 4. Margem Real vs Prevista */}
          <div className="rounded-xl border bg-card p-4 grid gap-1 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Margem Real Alcançada</span>
              <PercentIcon className="size-4 text-muted-foreground" />
            </div>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${verdictColorClass}`}>
              {realMargin !== null ? formatPercent(realMargin) : "—"}
            </p>
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <p>
                Meta contratada:{" "}
                <strong className="text-foreground">{formatPercent(desiredMargin)}</strong>
              </p>
              {marginGapPoints !== null ? (
                <p className={marginGapPoints >= 0 ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>
                  Desvio: {marginGapPoints >= 0 ? "+" : ""}
                  {marginGapPoints.toFixed(1)} p.p. da meta
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Parecer Executivo / Diagnóstico */}
        <div className="rounded-xl border bg-muted/40 p-4 sm:p-5 grid gap-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm uppercase tracking-wider text-foreground">
              Diagnóstico de Rentabilidade
            </h4>
          </div>

          <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
            {metTarget ? (
              <p>
                O contrato encerrou com <strong>resultado altamente positivo</strong> para a consultoria.
                Gerou um lucro líquido acumulado de <strong>{formatCurrency(profit)}</strong> com margem real de{" "}
                <strong>{formatPercent(realMargin)}</strong>, superando a meta contratual de{" "}
                <strong>{formatPercent(desiredMargin)}</strong> em{" "}
                <strong>+{marginGapPoints?.toFixed(1)} pontos percentuais</strong>.
              </p>
            ) : isProfitable ? (
              <p>
                O contrato encerrou com <strong>saldo positivo de caixa ({formatCurrency(profit)})</strong>, porém
                com <strong>margem de lucro reduzida ({formatPercent(realMargin)})</strong>, ficando abaixo da meta de{" "}
                <strong>{formatPercent(desiredMargin)}</strong> ({marginGapPoints?.toFixed(1)} p.p.). O volume de
                horas consumido pela equipe absorveu uma fatia maior do orçamento do que o planejado originalmente.
              </p>
            ) : isBreakeven ? (
              <p>
                O contrato encerrou em <strong>ponto de equilíbrio rigoroso</strong> ({formatCurrency(profit)}). Toda a
                receita auferida foi integralmente consumida pelos custos de alocação de equipe e despesas.
              </p>
            ) : (
              <p>
                O contrato encerrou em <strong>situação de prejuízo operacional</strong> de{" "}
                <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(profit)}</strong> (margem de{" "}
                <strong>{formatPercent(realMargin)}</strong>). Os custos totais da equipe (
                {formatCurrency(laborCost)}) e gastos ({formatCurrency(expenseCost)}) excederam a receita auferida
                no relacionamento.
              </p>
            )}

            {penalty > 0 ? (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs sm:text-sm text-foreground">
                <p>
                  <strong>Impacto da Multa Rescisória:</strong> O recebimento extraordinário de{" "}
                  <strong>{formatCurrency(penalty)}</strong> ({formatCurrency(penalty * (1 - taxFraction))} líquidos)
                  foi essencial para a saúde do fechamento.
                  {!isProfitable && penalty > 0
                    ? ` Mesmo com a multa, o contrato não conseguiu recuperar o déficit acumulado de horas.`
                    : profit - penalty * (1 - taxFraction) < 0
                      ? ` Sem a multa rescisória, o contrato teria fechado no prejuízo com déficit de ${formatCurrency(profit - penalty * (1 - taxFraction))}.`
                      : ` A multa incrementou ainda mais o resultado líquido final da consultoria.`}
                </p>
              </div>
            ) : null}
          </div>

          {topEmployees.length > 0 ? (
            <div className="pt-2 border-t text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium text-foreground">Principais colaboradores no projeto:</span>
              {topEmployees.map((emp) => (
                <span key={emp.employee_id}>
                  {emp.employee_name}: <strong>{formatHours(Number(emp.hours))}</strong> ({formatCurrency(Number(emp.labor_cost))})
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
