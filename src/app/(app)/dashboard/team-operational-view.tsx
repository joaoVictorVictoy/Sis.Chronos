"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  DollarSignIcon,
  UserCheckIcon,
  UserXIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  LayersIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import type { TeamOperationalReport } from "@/lib/server/metrics";
import { toggleEmployeeActiveAction } from "@/app/(app)/colaboradores/actions";
import { useActionState } from "react";
import { initialActionState } from "@/lib/actions";
import { FormAlert, SubmitButton } from "@/components/form";

function EmployeeStatusToggle({ employeeId, active }: { employeeId: string; active: boolean }) {
  const [state, formAction] = useActionState(toggleEmployeeActiveAction, initialActionState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {active ? (
        <SubmitButton
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
        >
          <UserXIcon className="size-3.5" />
          Desativar
        </SubmitButton>
      ) : (
        <SubmitButton
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-emerald-500/30 text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
        >
          <UserCheckIcon className="size-3.5" />
          Reativar
        </SubmitButton>
      )}
      {state.error ? <FormAlert state={state} /> : null}
    </form>
  );
}

export function TeamOperationalView({ report }: { report: TeamOperationalReport }) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="grid gap-6">
      {/* 1. Blocos Resumo no Topo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium text-muted-foreground">Total de Horas</CardDescription>
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <ClockIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{formatHours(report.totalHours)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {report.uniqueDaysWorked} {report.uniqueDaysWorked === 1 ? "dia único trabalhado" : "dias únicos com apontamentos"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium text-muted-foreground">Média por Dia Trabalhado</CardDescription>
            <div className="rounded-md bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
              <TrendingUpIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatHours(report.averageDailyHours)}
              <span className="text-xs font-normal text-muted-foreground">/dia</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total de horas ÷ Dias únicos apontados
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium text-muted-foreground">Custo Total Acumulado</CardDescription>
            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <DollarSignIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{formatCurrency(report.totalLaborCost)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Custo operacional direto no período
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="font-medium text-muted-foreground">Maior Consumo Médio</CardDescription>
            <div className="rounded-md bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <LayersIcon className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {report.topConsumingActivities.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados de atividades</p>
            ) : (
              report.topConsumingActivities.slice(0, 2).map((act, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-[130px] font-medium" title={act.name}>
                    {act.name}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatHours(act.avgHours)}
                    <span className="text-[10px] text-muted-foreground font-normal">/apont</span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. Lista por Colaborador Abaixo dos Blocos (Accordion) */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <CardTitle className="text-lg font-semibold tracking-tight">Desempenho por Colaborador</CardTitle>
          <CardDescription>
            Acompanhe o total de horas, média por dia trabalhado, custo acumulado e detalhe individual dos apontamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {report.members.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum colaborador encontrado na empresa.
            </div>
          ) : (
            report.members.map((member) => {
              const isExpanded = !!expandedIds[member.id];
              return (
                <div key={member.id} className="transition-colors hover:bg-muted/15">
                  {/* Linha Cabeçalho */}
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                      onClick={() => toggleExpand(member.id)}
                    >
                      <button
                        type="button"
                        aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
                        className="flex size-7 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted"
                      >
                        {isExpanded ? (
                          <ChevronUpIcon className="size-4" />
                        ) : (
                          <ChevronDownIcon className="size-4" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-foreground">
                            {member.name}
                          </span>
                          {!member.active ? (
                            <Badge variant="destructive" className="h-5 text-[10px]">
                              Inativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-5 text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                              Ativo
                            </Badge>
                          )}
                        </div>
                        {member.jobTitle ? (
                          <p className="text-xs text-muted-foreground">{member.jobTitle}</p>
                        ) : null}
                      </div>
                    </div>

                    {/* Métricas do Colaborador */}
                    <div className="flex flex-wrap items-center gap-4 text-sm sm:gap-6">
                      <div className="text-left sm:text-right">
                        <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Total Horas
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatHours(member.totalHours)}
                        </span>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Média Diária
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatHours(member.dailyAverage)}
                          <span className="text-xs font-normal text-muted-foreground">/dia</span>
                        </span>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Custo Total
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatCurrency(member.totalCost)}
                        </span>
                      </div>

                      <div className="pl-2">
                        <EmployeeStatusToggle employeeId={member.id} active={member.active} />
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo Expandido: Apontamentos Individuais */}
                  {isExpanded ? (
                    <div className="border-t bg-muted/20 px-4 py-3 sm:px-6">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Apontamentos do Período ({member.entries.length})
                      </h4>
                      {member.entries.length === 0 ? (
                        <p className="py-3 text-xs text-muted-foreground">
                          Nenhum apontamento registrado para este colaborador no período selecionado.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead className="w-28">Data</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Área</TableHead>
                                <TableHead>Atividade</TableHead>
                                <TableHead className="text-right">Horas</TableHead>
                                <TableHead className="text-right">Custo</TableHead>
                                <TableHead className="text-center w-24">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="text-xs">
                              {member.entries.map((entry) => (
                                <TableRow key={entry.id}>
                                  <TableCell className="font-medium whitespace-nowrap">
                                    {formatDate(entry.date)}
                                  </TableCell>
                                  <TableCell className="font-medium text-foreground">
                                    {entry.clientName}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {entry.areaName}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {entry.activityName}
                                    {!entry.billable ? (
                                      <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">
                                        (não faturável)
                                      </span>
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold tabular-nums">
                                    {formatHours(entry.hours)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-foreground">
                                    {formatCurrency(entry.cost)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant={
                                        entry.status === "aprovado"
                                          ? "default"
                                          : entry.status === "rejeitado"
                                          ? "destructive"
                                          : "secondary"
                                      }
                                      className="text-[10px] capitalize"
                                    >
                                      {entry.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
