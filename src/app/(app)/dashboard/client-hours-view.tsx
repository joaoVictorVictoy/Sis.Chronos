"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BriefcaseIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  SearchIcon,
  SheetIcon,
  UsersIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/page-header";
import { formatCurrency, formatDate, formatHours, formatPercent } from "@/lib/format";
import type { ClientHoursReport, ClientHoursSummary } from "@/lib/server/metrics.types";

export function ClientHoursView({
  report,
  canSeeCosts = true,
  initialClientId,
}: {
  report: ClientHoursReport;
  canSeeCosts?: boolean;
  initialClientId?: string;
}) {
  const clients = report.clients;

  // Encontra o cliente inicial: passado por param, ou o primeiro com horas, ou o primeiro da lista
  const defaultClient = useMemo(() => {
    if (initialClientId) {
      const found = clients.find((c) => c.id === initialClientId);
      if (found) return found;
    }
    const withHours = clients.find((c) => c.totalMinutes > 0);
    return withHours ?? clients[0];
  }, [clients, initialClientId]);

  const [selectedClientId, setSelectedClientId] = useState<string>(defaultClient?.id ?? "");
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("todos");
  const [billableFilter, setBillableFilter] = useState<"todos" | "sim" | "nao">("todos");

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) ?? defaultClient;
  }, [clients, selectedClientId, defaultClient]);

  // Filtra as entradas do extrato em tempo real
  const filteredEntries = useMemo(() => {
    if (!selectedClient) return [];
    return selectedClient.entries.filter((entry) => {
      if (employeeFilter !== "todos" && entry.employeeId !== employeeFilter) {
        return false;
      }
      if (billableFilter === "sim" && !entry.billable) return false;
      if (billableFilter === "nao" && entry.billable) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const inDesc = entry.description?.toLowerCase().includes(q) ?? false;
        const inEmp = entry.employeeName.toLowerCase().includes(q);
        const inAct = entry.activityName.toLowerCase().includes(q);
        const inArea = entry.areaName.toLowerCase().includes(q);
        const inContract = entry.contractName?.toLowerCase().includes(q) ?? false;
        if (!inDesc && !inEmp && !inAct && !inArea && !inContract) return false;
      }

      return true;
    });
  }, [selectedClient, employeeFilter, billableFilter, search]);

  const filteredMinutes = useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + e.minutes, 0);
  }, [filteredEntries]);

  const filteredCost = useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + e.costAmount, 0);
  }, [filteredEntries]);

  // Clientes com mais horas no período para atalhos rápidos
  const topClients = useMemo(() => {
    return clients.filter((c) => c.totalMinutes > 0).slice(0, 5);
  }, [clients]);

  // URL de exportação para este cliente
  const exportUrl = (format: "csv" | "xlsx" | "pdf") => {
    const params = new URLSearchParams({
      formato: format,
      de: report.period.from,
      ate: report.period.to,
      cliente: selectedClient?.id ?? "",
    });
    return `/exportar/apontamentos?${params.toString()}`;
  };

  if (!selectedClient) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState>Nenhum cliente cadastrado no sistema.</EmptyState>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Barra de Seleção de Cliente e Ações */}
      <Card className="border-primary/20 bg-card/60 backdrop-blur-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <BriefcaseIcon className="size-5 text-primary" />
                <CardTitle className="text-xl">Horas Apontadas por Cliente</CardTitle>
                <Badge variant="outline" className="ml-1 text-xs font-normal">
                  {report.period.label}
                </Badge>
              </div>
              <CardDescription>
                Consolidação de todos os apontamentos, colaboradores alocados e extrato detalhado do mês.
              </CardDescription>
            </div>

            {/* Exportação individual do cliente */}
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="gap-1.5 shadow-xs">
                      <DownloadIcon className="size-4" />
                      Exportar Extrato do Cliente
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Extrato de {selectedClient.name}</DropdownMenuLabel>
                  <DropdownMenuItem render={<a href={exportUrl("xlsx")} download />}>
                    <FileSpreadsheetIcon className="size-4" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<a href={exportUrl("csv")} download />}>
                    <SheetIcon className="size-4" />
                    CSV (abre no Excel)
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<a href={exportUrl("pdf")} download />}>
                    <FileTextIcon className="size-4" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={`/clientes/${selectedClient.id}`} />}
              >
                Ver cadastro do cliente
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 pt-0">
          {/* Seletor dropdown e atalhos */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-80">
              <label htmlFor="client-select" className="mb-1 block text-xs font-medium text-muted-foreground">
                Selecione o Cliente:
              </label>
              <select
                id="client-select"
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSearch("");
                  setEmployeeFilter("todos");
                  setBillableFilter("todos");
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.totalHours > 0 ? `(${formatHours(c.totalHours)})` : "(sem horas no mês)"}
                  </option>
                ))}
              </select>
            </div>

            {/* Chips de clientes com maior volume no mês */}
            {topClients.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 sm:pt-4">
                <span className="text-xs text-muted-foreground">Mais apontados:</span>
                {topClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedClientId(c.id);
                      setSearch("");
                      setEmployeeFilter("todos");
                      setBillableFilter("todos");
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                      selectedClientId === c.id
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/70 text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="opacity-80">· {formatHours(c.totalHours)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Visão do Cliente Selecionado */}
      {selectedClient.totalMinutes === 0 ? (
        <Card className="py-8">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <ClockIcon className="mb-3 size-10 text-muted-foreground/40" />
            <h3 className="text-base font-semibold">Nenhum apontamento no período selecionado</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Não foram registradas horas para <strong className="text-foreground">{selectedClient.name}</strong>{" "}
              entre {formatDate(report.period.from)} e {formatDate(report.period.to)}.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Utilize o filtro de período no topo da página para consultar outros meses ou selecione outro cliente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grade de KPIs do Cliente */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full bg-primary/10" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs font-medium">
                  <ClockIcon className="size-3.5 text-primary" />
                  Total de Horas no Mês
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {formatHours(selectedClient.totalHours)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Equivalente a {selectedClient.totalHours.toFixed(1)}h decimais
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs font-medium">
                  <CheckCircle2Icon className="size-3.5 text-[--viz-good]" />
                  Horas Faturáveis
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums text-[--viz-good]">
                  {formatHours(selectedClient.billableHours)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatPercent(selectedClient.billableShare)} de aproveitamento faturável
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">Horas Não Faturáveis</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums text-muted-foreground">
                  {formatHours(selectedClient.nonBillableHours)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatPercent(1 - selectedClient.billableShare)} internas / não cobradas
              </CardContent>
            </Card>

            {canSeeCosts ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-medium">Custo Total da Equipe</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">
                    {formatCurrency(selectedClient.totalCost)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {selectedClient.totalHours > 0
                    ? `Custo médio ${formatCurrency(selectedClient.totalCost / selectedClient.totalHours)}/h`
                    : "—"}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1 text-xs font-medium">
                    <UsersIcon className="size-3.5 text-primary" />
                    Equipe e Lançamentos
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">
                    {selectedClient.employeesCount}{" "}
                    <span className="text-lg font-normal text-muted-foreground">
                      {selectedClient.employeesCount === 1 ? "membro" : "membros"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {selectedClient.entriesCount} lançamentos registrados no mês
                </CardContent>
              </Card>
            )}
          </div>

          {/* Seção de Distribuição: Colaboradores e Atividades */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Horas por Colaborador */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Equipe Alocada no Cliente</CardTitle>
                    <CardDescription className="text-xs">
                      Distribuição das {formatHours(selectedClient.totalHours)} entre os colaboradores no mês.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">
                    {selectedClient.employeesCount} {selectedClient.employeesCount === 1 ? "pessoa" : "pessoas"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {selectedClient.byEmployee.map((emp) => (
                  <div key={emp.id} className="grid gap-1.5 rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {emp.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium truncate">{emp.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        <span className="font-semibold">{formatHours(emp.hours)}</span>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {emp.percentage.toFixed(1)}%
                        </span>
                        {canSeeCosts && emp.cost > 0 && (
                          <span className="text-xs text-muted-foreground w-20 text-right">
                            {formatCurrency(emp.cost)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(100, emp.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Horas por Atividade */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Atividades Executadas</CardTitle>
                    <CardDescription className="text-xs">
                      Tempo dedicado por tipo de atividade e área de consultoria.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">
                    {selectedClient.byActivity.length} atividades
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {selectedClient.byActivity.map((act) => (
                  <div key={act.id} className="grid gap-1.5 rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-medium truncate">{act.name}</span>
                        <Badge
                          variant={act.billable ? "outline" : "secondary"}
                          className="text-[10px] py-0 px-1.5"
                        >
                          {act.billable ? "Faturável" : "Interna"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        <span className="font-semibold">{formatHours(act.hours)}</span>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {act.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Área: {act.areaName}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          act.billable ? "bg-[--viz-good]" : "bg-muted-foreground/60"
                        }`}
                        style={{ width: `${Math.min(100, act.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Extrato Detalhado de Apontamentos (Tabela Completa) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Extrato Completo de Lançamentos</CardTitle>
                  <CardDescription>
                    Lista item a item de todas as horas apontadas em {selectedClient.name} no mês.
                  </CardDescription>
                </div>

                {/* Filtros em linha */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Busca textual */}
                  <div className="relative w-full sm:w-60">
                    <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar descrição ou colaborador..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 text-xs h-9"
                    />
                  </div>

                  {/* Filtro por colaborador */}
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Filtrar por colaborador"
                  >
                    <option value="todos">Todos colaboradores</option>
                    {selectedClient.byEmployee.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>

                  {/* Filtro por faturabilidade */}
                  <select
                    value={billableFilter}
                    onChange={(e) => setBillableFilter(e.target.value as "todos" | "sim" | "nao")}
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Filtrar por tipo faturável"
                  >
                    <option value="todos">Todas (Faturáveis e não)</option>
                    <option value="sim">Apenas faturáveis</option>
                    <option value="nao">Apenas não faturáveis</option>
                  </select>
                </div>
              </div>

              {/* Barra de resumo dos filtros */}
              <div className="mt-2 flex flex-wrap items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                <span>
                  Mostrando <strong>{filteredEntries.length}</strong> de{" "}
                  <strong>{selectedClient.entriesCount}</strong> apontamentos
                </span>
                <span className="tabular-nums">
                  Total filtrado: <strong className="text-foreground">{formatHours(filteredMinutes / 60)}</strong>
                  {canSeeCosts && filteredCost > 0 ? ` · ${formatCurrency(filteredCost)}` : ""}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredEntries.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum apontamento corresponde aos filtros aplicados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-24">Data</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Atividade / Área</TableHead>
                        <TableHead>Contrato</TableHead>
                        <TableHead>Faturável</TableHead>
                        <TableHead className="text-right">Duração</TableHead>
                        <TableHead className="min-w-64">Descrição</TableHead>
                        <TableHead>Situação</TableHead>
                        {canSeeCosts && <TableHead className="text-right">Custo</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id} className="text-sm">
                          <TableCell className="font-medium whitespace-nowrap text-muted-foreground">
                            {formatDate(entry.entryDate)}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">
                            {entry.employeeName}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium leading-tight">{entry.activityName}</p>
                            <p className="text-xs text-muted-foreground leading-tight">{entry.areaName}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {entry.contractName ? (
                              <span className="font-medium text-foreground">{entry.contractName}</span>
                            ) : (
                              <span>Avulso / Geral</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={entry.billable ? "outline" : "secondary"}
                              className="text-[10px] font-normal"
                            >
                              {entry.billable ? "Sim" : "Não"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                            {formatHours(entry.hours)}
                            {entry.startTime && entry.endTime ? (
                              <p className="text-[11px] font-normal text-muted-foreground">
                                {entry.startTime} - {entry.endTime}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs text-foreground/90 max-w-sm">
                            <p className="line-clamp-2" title={entry.description ?? ""}>
                              {entry.description || <span className="italic text-muted-foreground">Sem descrição</span>}
                            </p>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={entry.status === "aprovado" ? "saudavel" : "atencao"} />
                          </TableCell>
                          {canSeeCosts && (
                            <TableCell className="text-right tabular-nums text-xs">
                              {entry.costAmount > 0 ? formatCurrency(entry.costAmount) : "—"}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
