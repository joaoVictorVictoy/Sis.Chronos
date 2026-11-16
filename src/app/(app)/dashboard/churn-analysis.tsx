import Link from "next/link";
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  DollarSignIcon,
  HelpCircleIcon,
  ShieldAlertIcon,
  TrendingDownIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/info-tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { TERMINATION_REASON_LABELS, TERMINATION_SUB_REASON_LABELS } from "@/lib/contracts";
import type { ChurnReport } from "@/lib/server/churn";

export function ChurnAnalysisCard({
  report,
  canManageContracts = false,
}: {
  report: ChurnReport;
  canManageContracts?: boolean;
}) {
  const hasChurn = report.totalTerminatedCount > 0;

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl font-bold tracking-tight">
            Inteligência de Churn & Evasão de Contratos
          </CardTitle>
          {hasChurn ? (
            <Badge variant="destructive" className="gap-1 text-xs">
              <TrendingDownIcon className="size-3" />
              {formatPercent(report.churnRate)} churn rate
            </Badge>
          ) : (
            <Badge variant="default" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-600 text-white">
              <CheckCircle2Icon className="size-3" />
              0% churn rate
            </Badge>
          )}
          <InfoTooltip
            side="right"
            text={`Receita recorrente perdida (MRR), causas de saída e diagnóstico de gargalos de atendimento no período (${report.period.label}).`}
          />
        </div>

        {hasChurn ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground">
            <span>MRR Perdido:</span>
            <strong className="text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
              {formatCurrency(report.lostMrr)}/mês
            </strong>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="grid gap-6">
        {!hasChurn ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 py-8 px-4 text-center">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400 mb-3">
              <CheckCircle2Icon className="size-6" />
            </div>
            <h4 className="font-semibold text-base text-foreground">
              Nenhuma evasão de clientes neste período
            </h4>
            <p className="mt-1 max-w-md text-xs sm:text-sm text-muted-foreground">
              Todos os contratos permaneceram ativos ou foram renovados. A carteira ativa segue gerando{" "}
              <strong>{formatCurrency(report.activeMrr)}/mês</strong> em receita recorrente.
            </p>
          </div>
        ) : (
          <>
            {/* 4 Cards de Métricas de Churn */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-card p-4 grid gap-1 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>MRR Perdido</span>
                  <TrendingDownIcon className="size-3.5 text-rose-500" />
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
                  {formatCurrency(report.lostMrr)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Impacto anual: <strong>{formatCurrency(report.lostAnnualRevenue)}</strong>
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4 grid gap-1 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Taxa de Churn de MRR</span>
                  <span className="font-mono text-[10px] uppercase">Receita</span>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {formatPercent(report.churnRate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Base ativa: {formatCurrency(report.activeMrr)}/mês
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4 grid gap-1 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Contratos Encerrados</span>
                  <UsersIcon className="size-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {report.totalTerminatedCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {report.actualChurnCount} rescisão(ões) antecipada(s) · {report.regularEndCount} fim regular
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4 grid gap-1 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    Multas Recuperadas
                    <InfoTooltip text="Receita extraordinária de rescisão" />
                  </span>
                  <DollarSignIcon className="size-3.5 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(report.totalPenalties)}
                </p>
              </div>
            </div>

            {/* Diagnóstico de Gargalos (Entrega, Financeiro ou Concorrência) */}
            {report.bottlenecks.length > 0 ? (
              <div className="grid gap-3">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Diagnóstico Estratégico de Gargalos
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {report.bottlenecks.map((b) => {
                    const isDelivery = b.type === "entrega";
                    const isFinance = b.type === "financeiro";

                    return (
                      <div
                        key={b.type}
                        className={`rounded-xl border p-4 grid gap-2 ${
                          isDelivery
                            ? "border-rose-500/40 bg-rose-500/5 text-rose-950 dark:text-rose-100"
                            : isFinance
                              ? "border-amber-500/40 bg-amber-500/5 text-amber-950 dark:text-amber-100"
                              : "border-blue-500/40 bg-blue-500/5 text-blue-950 dark:text-blue-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          {isDelivery ? (
                            <ShieldAlertIcon className="size-4 text-rose-600 shrink-0" />
                          ) : isFinance ? (
                            <AlertTriangleIcon className="size-4 text-amber-600 shrink-0" />
                          ) : (
                            <AlertOctagonIcon className="size-4 text-blue-600 shrink-0" />
                          )}
                          <span>{b.title}</span>
                        </div>
                        <p className="text-xs leading-relaxed opacity-90">{b.description}</p>
                        <div className="mt-1 pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                          <span>Receita impactada:</span>
                          <strong className="font-semibold tabular-nums">{formatCurrency(b.lostMrr)}/mês</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Motivos de Saída (Ranking / Distribuição) */}
            {report.reasonsBreakdown.length > 0 ? (
              <div className="grid gap-3">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Principais Motivos de Saída
                </h4>
                <div className="grid gap-2">
                  {report.reasonsBreakdown.map((group) => (
                    <div
                      key={group.key}
                      className="flex flex-col gap-1.5 rounded-lg border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="grid gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{group.label}</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            {group.count} {group.count === 1 ? "contrato" : "contratos"}
                          </Badge>
                        </div>
                        <div className="h-1.5 w-48 rounded-full bg-muted overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              group.category === "cliente"
                                ? "bg-rose-500"
                                : group.category === "consultoria"
                                  ? "bg-amber-500"
                                  : "bg-muted-foreground"
                            }`}
                            style={{ width: `${Math.min(group.percentage, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto text-right">
                        <div>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatCurrency(group.lostMrr)}/mês
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {group.percentage.toFixed(1)}% da perda
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Lista Detalhada dos Contratos Evasores */}
            <div className="grid gap-3">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Contratos Encerrados no Período
              </h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente / Contrato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Motivo Principal</TableHead>
                      <TableHead>Causa Específica</TableHead>
                      <TableHead className="text-right">MRR Perdido</TableHead>
                      <TableHead className="text-right">Multa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.contracts.map((c) => {
                      const reasonText = c.terminationReason
                        ? TERMINATION_REASON_LABELS[c.terminationReason] ?? c.terminationReason
                        : "Não informado";
                      const subReasonText = c.terminationSubReason
                        ? TERMINATION_SUB_REASON_LABELS[c.terminationSubReason] ?? c.terminationSubReason
                        : "—";

                      const isCritical =
                        c.terminationSubReason === "insatisfacao" || c.terminationSubReason === "escopo_inviavel";

                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            {canManageContracts ? (
                              <Link href={`/contratos/${c.id}`} className="font-medium hover:underline block">
                                {c.name}
                              </Link>
                            ) : (
                              <span className="font-medium block">{c.name}</span>
                            )}
                            <span className="text-xs text-muted-foreground">{c.clientName}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {c.terminatedAt ? formatDate(c.terminatedAt) : c.endDate ? formatDate(c.endDate) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="line-clamp-1">{reasonText}</span>
                          </TableCell>
                          <TableCell>
                            {c.terminationSubReason ? (
                              <Badge
                                variant={isCritical ? "destructive" : "secondary"}
                                className="text-[11px] font-normal"
                              >
                                {subReasonText}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {formatCurrency(c.monthlyRevenue)}/mês
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {c.terminationPenalty ? formatCurrency(c.terminationPenalty) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
