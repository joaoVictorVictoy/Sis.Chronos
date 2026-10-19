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
  LayersIcon,
  ListFilterIcon,
  RotateCcwIcon,
  SearchIcon,
  SheetIcon,
  TagIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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
  const [areaFilter, setAreaFilter] = useState<string>("todas");
  const [activityFilter, setActivityFilter] = useState<string>("todas");
  const [billableFilter, setBillableFilter] = useState<"todos" | "sim" | "nao">("todos");
  const [viewMode, setViewMode] = useState<"areas" | "atividades" | "colaboradores" | "todas">("areas");
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [showAreaEmployees, setShowAreaEmployees] = useState(true);
  const [individualAreaEmployees, setIndividualAreaEmployees] = useState<Record<string, boolean>>({});
  const [isExtratoOpen, setIsExtratoOpen] = useState(true);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) ?? defaultClient;
  }, [clients, selectedClientId, defaultClient]);

  // Opções de filtros dinâmicos extraídas dos lançamentos do cliente
  const filterOptions = useMemo(() => {
    if (!selectedClient) {
      return { employees: [], areas: [], activities: [] };
    }

    const empMap = new Map<string, string>();
    const areaSet = new Set<string>();
    const actMap = new Map<string, { id: string; name: string; areaName: string }>();

    for (const e of selectedClient.entries) {
      empMap.set(e.employeeId, e.employeeName);
      if (e.areaName) areaSet.add(e.areaName);
      actMap.set(e.activityId, { id: e.activityId, name: e.activityName, areaName: e.areaName });
    }

    const employees = Array.from(empMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const areas = Array.from(areaSet).sort((a, b) => a.localeCompare(b));

    const activities = Array.from(actMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return { employees, areas, activities };
  }, [selectedClient]);

  // Filtra as entradas do extrato em tempo real
  const filteredEntries = useMemo(() => {
    if (!selectedClient) return [];
    return selectedClient.entries.filter((entry) => {
      if (employeeFilter !== "todos" && entry.employeeId !== employeeFilter) {
        return false;
      }
      if (areaFilter !== "todas" && entry.areaName !== areaFilter) {
        return false;
      }
      if (activityFilter !== "todas" && entry.activityId !== activityFilter) {
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
  }, [selectedClient, employeeFilter, areaFilter, activityFilter, billableFilter, search]);

  // Métricas dinâmicas recalculadas sobre o filtro
  const metrics = useMemo(() => {
    let minutes = 0;
    let billableMins = 0;
    let cost = 0;
    const empSet = new Set<string>();

    for (const e of filteredEntries) {
      minutes += e.minutes;
      if (e.billable) billableMins += e.minutes;
      cost += e.costAmount;
      empSet.add(e.employeeId);
    }

    const hours = minutes / 60;
    const billableHours = billableMins / 60;
    const nonBillableHours = (minutes - billableMins) / 60;
    const billableShare = minutes > 0 ? billableMins / minutes : 0;

    return {
      minutes,
      hours,
      billableHours,
      nonBillableHours,
      billableShare,
      cost,
      employeesCount: empSet.size,
    };
  }, [filteredEntries]);

  // Agrupamento consolidado dinâmico por Área de Atuação
  const byAreaDynamic = useMemo(() => {
    if (!filteredEntries.length) return [];

    const map = new Map<
      string,
      {
        name: string;
        minutes: number;
        cost: number;
        billableMinutes: number;
        entriesCount: number;
        activitiesMap: Map<string, { id: string; name: string; minutes: number; billable: boolean; cost: number }>;
        employeesMap: Map<string, { id: string; name: string; minutes: number; cost: number; entriesCount: number }>;
      }
    >();

    for (const e of filteredEntries) {
      const areaKey = e.areaName || "Sem área";
      let area = map.get(areaKey);
      if (!area) {
        area = {
          name: areaKey,
          minutes: 0,
          cost: 0,
          billableMinutes: 0,
          entriesCount: 0,
          activitiesMap: new Map(),
          employeesMap: new Map(),
        };
        map.set(areaKey, area);
      }

      area.minutes += e.minutes;
      area.cost += e.costAmount;
      if (e.billable) area.billableMinutes += e.minutes;
      area.entriesCount += 1;

      const emp = area.employeesMap.get(e.employeeId) ?? {
        id: e.employeeId,
        name: e.employeeName,
        minutes: 0,
        cost: 0,
        entriesCount: 0,
      };
      emp.minutes += e.minutes;
      emp.cost += e.costAmount;
      emp.entriesCount += 1;
      area.employeesMap.set(e.employeeId, emp);

      const act = area.activitiesMap.get(e.activityId) ?? {
        id: e.activityId,
        name: e.activityName,
        minutes: 0,
        billable: e.billable,
        cost: 0,
      };
      act.minutes += e.minutes;
      act.cost += e.costAmount;
      area.activitiesMap.set(e.activityId, act);
    }

    const totalFilteredMins = metrics.minutes || 1;

    return Array.from(map.values())
      .map((a) => {
        const activities = Array.from(a.activitiesMap.values())
          .map((act) => ({
            ...act,
            hours: act.minutes / 60,
            percentageInArea: a.minutes > 0 ? (act.minutes / a.minutes) * 100 : 0,
          }))
          .sort((x, y) => y.minutes - x.minutes);

        const employees = Array.from(a.employeesMap.values())
          .map((emp) => ({
            ...emp,
            hours: emp.minutes / 60,
            percentageInArea: a.minutes > 0 ? (emp.minutes / a.minutes) * 100 : 0,
          }))
          .sort((x, y) => y.minutes - x.minutes);

        return {
          name: a.name,
          minutes: a.minutes,
          hours: a.minutes / 60,
          cost: a.cost,
          billableMinutes: a.billableMinutes,
          billableHours: a.billableMinutes / 60,
          billableShare: a.minutes > 0 ? (a.billableMinutes / a.minutes) * 100 : 0,
          percentage: (a.minutes / totalFilteredMins) * 100,
          entriesCount: a.entriesCount,
          activitiesCount: a.activitiesMap.size,
          activities,
          employees,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredEntries, metrics.minutes]);

  // Agrupamento consolidado dinâmico por Atividade
  const byActivityDynamic = useMemo(() => {
    if (!filteredEntries.length) return [];

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        areaName: string;
        minutes: number;
        cost: number;
        billable: boolean;
        entriesCount: number;
        employeesSet: Set<string>;
      }
    >();

    for (const e of filteredEntries) {
      let act = map.get(e.activityId);
      if (!act) {
        act = {
          id: e.activityId,
          name: e.activityName,
          areaName: e.areaName,
          minutes: 0,
          cost: 0,
          billable: e.billable,
          entriesCount: 0,
          employeesSet: new Set(),
        };
        map.set(e.activityId, act);
      }
      act.minutes += e.minutes;
      act.cost += e.costAmount;
      act.entriesCount += 1;
      act.employeesSet.add(e.employeeName);
    }

    const totalFilteredMins = metrics.minutes || 1;

    return Array.from(map.values())
      .map((a) => ({
        ...a,
        hours: a.minutes / 60,
        percentage: (a.minutes / totalFilteredMins) * 100,
        employees: Array.from(a.employeesSet),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredEntries, metrics.minutes]);

  // Agrupamento consolidado dinâmico por Colaborador
  const byEmployeeDynamic = useMemo(() => {
    if (!filteredEntries.length) return [];

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        minutes: number;
        cost: number;
        entriesCount: number;
        areasSet: Set<string>;
      }
    >();

    for (const e of filteredEntries) {
      let emp = map.get(e.employeeId);
      if (!emp) {
        emp = {
          id: e.employeeId,
          name: e.employeeName,
          minutes: 0,
          cost: 0,
          entriesCount: 0,
          areasSet: new Set(),
        };
        map.set(e.employeeId, emp);
      }
      emp.minutes += e.minutes;
      emp.cost += e.costAmount;
      emp.entriesCount += 1;
      if (e.areaName) emp.areasSet.add(e.areaName);
    }

    const totalFilteredMins = metrics.minutes || 1;

    return Array.from(map.values())
      .map((e) => ({
        ...e,
        hours: e.minutes / 60,
        percentage: (e.minutes / totalFilteredMins) * 100,
        areas: Array.from(e.areasSet),
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredEntries, metrics.minutes]);

  // Alterna expansão de uma área para exibir suas atividades
  const toggleAreaExpand = (areaName: string) => {
    setExpandedAreas((prev) => ({
      ...prev,
      [areaName]: !prev[areaName],
    }));
  };

  // Alterna exibição de colaboradores dentro de uma área específica
  const toggleAreaEmployees = (areaName: string) => {
    setIndividualAreaEmployees((prev) => {
      const current = prev[areaName] ?? showAreaEmployees;
      return {
        ...prev,
        [areaName]: !current,
      };
    });
  };

  const isAnyFilterActive =
    employeeFilter !== "todos" ||
    areaFilter !== "todas" ||
    activityFilter !== "todas" ||
    billableFilter !== "todos" ||
    search.trim() !== "";

  const resetFilters = () => {
    setEmployeeFilter("todos");
    setAreaFilter("todas");
    setActivityFilter("todas");
    setBillableFilter("todos");
    setSearch("");
  };

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
                Consolidação dinâmica de apontamentos por cliente com visão por Área de Atuação, Atividade e Colaborador.
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
                  resetFilters();
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
                      resetFilters();
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
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
          {/* Barra de Filtros Cruzados Dinâmicos */}
          <Card className="border-dashed bg-muted/20">
            <CardHeader className="py-3 px-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ListFilterIcon className="size-4 text-primary" />
                  <span className="text-sm font-semibold">Filtros Cruzados do Cliente</span>
                  {isAnyFilterActive && (
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      Filtro ativo · dados consolidados recalculados
                    </Badge>
                  )}
                </div>

                {isAnyFilterActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Limpar filtros
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 grid gap-3">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                {/* 1. Filtro por Colaborador */}
                <div className="grid gap-1">
                  <label htmlFor="filter-employee" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <UsersIcon className="size-3" /> Colaborador
                  </label>
                  <select
                    id="filter-employee"
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="todos">Todos os colaboradores ({filterOptions.employees.length})</option>
                    {filterOptions.employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Filtro por Área de Atuação */}
                <div className="grid gap-1">
                  <label htmlFor="filter-area" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <LayersIcon className="size-3" /> Área de Atuação
                  </label>
                  <select
                    id="filter-area"
                    value={areaFilter}
                    onChange={(e) => setAreaFilter(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="todas">Todas as áreas ({filterOptions.areas.length})</option>
                    {filterOptions.areas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Filtro por Atividade */}
                <div className="grid gap-1">
                  <label htmlFor="filter-activity" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <TagIcon className="size-3" /> Atividade
                  </label>
                  <select
                    id="filter-activity"
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="todas">Todas as atividades ({filterOptions.activities.length})</option>
                    {filterOptions.activities
                      .filter((act) => areaFilter === "todas" || act.areaName === areaFilter)
                      .map((act) => (
                        <option key={act.id} value={act.id}>
                          {act.name} ({act.areaName})
                        </option>
                      ))}
                  </select>
                </div>

                {/* 4. Filtro por Faturabilidade */}
                <div className="grid gap-1">
                  <label htmlFor="filter-billable" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CheckCircle2Icon className="size-3" /> Tipo
                  </label>
                  <select
                    id="filter-billable"
                    value={billableFilter}
                    onChange={(e) => setBillableFilter(e.target.value as "todos" | "sim" | "nao")}
                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="todos">Faturáveis e Internas</option>
                    <option value="sim">Apenas faturáveis</option>
                    <option value="nao">Apenas internas / não faturáveis</option>
                  </select>
                </div>

                {/* 5. Busca Textual */}
                <div className="grid gap-1">
                  <label htmlFor="filter-search" className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <SearchIcon className="size-3" /> Busca rápida
                  </label>
                  <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      id="filter-search"
                      placeholder="Descrição, contrato..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grade de KPIs Dinâmicos Recalculados */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 right-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full bg-primary/10" />
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs font-medium">
                  <ClockIcon className="size-3.5 text-primary" />
                  Horas Consolidadas
                  {isAnyFilterActive && (
                    <span className="text-[10px] text-primary font-normal">(Filtrado)</span>
                  )}
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">
                  {formatHours(metrics.hours)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center justify-between">
                <span>{metrics.hours.toFixed(1)}h decimais</span>
                {isAnyFilterActive && (
                  <span className="font-medium text-foreground">
                    {formatPercent(selectedClient.totalMinutes > 0 ? metrics.minutes / selectedClient.totalMinutes : 0)} do cliente
                  </span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs font-medium">
                  <CheckCircle2Icon className="size-3.5 text-[--viz-good]" />
                  Horas Faturáveis
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums text-[--viz-good]">
                  {formatHours(metrics.billableHours)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatPercent(metrics.billableShare)} de aproveitamento faturável
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">Horas Não Faturáveis</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums text-muted-foreground">
                  {formatHours(metrics.nonBillableHours)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {formatPercent(1 - metrics.billableShare)} internas / não cobradas
              </CardContent>
            </Card>

            {canSeeCosts ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-medium">Custo da Equipe</CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">
                    {formatCurrency(metrics.cost)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {metrics.hours > 0 ? `Custo médio ${formatCurrency(metrics.cost / metrics.hours)}/h` : "—"}
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
                    {metrics.employeesCount}{" "}
                    <span className="text-lg font-normal text-muted-foreground">
                      {metrics.employeesCount === 1 ? "membro" : "membros"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {filteredEntries.length} lançamentos considerados
                </CardContent>
              </Card>
            )}
          </div>

          {/* Seletor de Modo de Visualização Consolidada */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
            <div>
              <h3 className="text-base font-semibold">Visualização Consolidada de Horas</h3>
              <p className="text-xs text-muted-foreground">
                Alterne a forma de consolidação para analisar por área técnica, por atividade ou pela equipe alocada.
              </p>
            </div>

            <div className="inline-flex rounded-lg border bg-muted/60 p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("areas")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all cursor-pointer ${
                  viewMode === "areas"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayersIcon className="size-3.5" />
                Por Área de Atuação
                <Badge variant="secondary" className="text-[10px] py-0 px-1 ml-0.5">
                  {byAreaDynamic.length}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("atividades")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all cursor-pointer ${
                  viewMode === "atividades"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TagIcon className="size-3.5" />
                Por Atividade
                <Badge variant="secondary" className="text-[10px] py-0 px-1 ml-0.5">
                  {byActivityDynamic.length}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("colaboradores")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all cursor-pointer ${
                  viewMode === "colaboradores"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UsersIcon className="size-3.5" />
                Por Colaborador
                <Badge variant="secondary" className="text-[10px] py-0 px-1 ml-0.5">
                  {byEmployeeDynamic.length}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("todas")}
                className={`hidden md:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all cursor-pointer ${
                  viewMode === "todas"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Visão Completa
              </button>
            </div>
          </div>

          {/* 1. VISÃO CONSOLIDADA POR ÁREA DE ATUAÇÃO (Foco solicitado pelo usuário) */}
          {(viewMode === "areas" || viewMode === "todas") && (
            <Card className="border-primary/20 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <LayersIcon className="size-4 text-primary" />
                      <CardTitle className="text-base font-semibold">
                        Horas Consolidadas Por Área de Atuação
                      </CardTitle>
                      <Badge variant="secondary" className="tabular-nums text-xs">
                        {byAreaDynamic.length} {byAreaDynamic.length === 1 ? "área ativa" : "áreas ativas"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Distribuição do tempo e custo por especialidade jurídica/consultoria. Clique em cada área para detalhar as atividades executadas.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {areaFilter !== "todas" && (
                      <Badge variant="outline" className="text-xs gap-1">
                        Filtrado pela área: <strong className="text-foreground">{areaFilter}</strong>
                      </Badge>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAreaEmployees((prev) => !prev);
                        setIndividualAreaEmployees({});
                      }}
                      className="h-7 text-xs gap-1 shadow-xs cursor-pointer"
                    >
                      <UsersIcon className="size-3.5" />
                      {showAreaEmployees ? "Esconder colaboradores" : "Mostrar colaboradores"}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3 pt-0">
                {byAreaDynamic.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Nenhuma área encontrada para os filtros selecionados.
                  </p>
                ) : (
                  byAreaDynamic.map((area) => {
                    const isExpanded = expandedAreas[area.name] ?? (byAreaDynamic.length <= 3);
                    const isEmpVisible = individualAreaEmployees[area.name] ?? showAreaEmployees;

                    return (
                      <div
                        key={area.name}
                        className={`grid gap-3 rounded-xl border p-4 transition-all ${
                          areaFilter === area.name
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "bg-card hover:border-primary/40"
                        }`}
                      >
                        {/* Linha principal da Área */}
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-base text-foreground">{area.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {area.activitiesCount} {area.activitiesCount === 1 ? "atividade" : "atividades"}
                              </Badge>
                              {areaFilter === "todas" ? (
                                <button
                                  type="button"
                                  onClick={() => setAreaFilter(area.name)}
                                  className="text-[11px] text-primary hover:underline cursor-pointer"
                                  title="Filtrar todo o relatório por esta área"
                                >
                                  (Filtrar só esta área)
                                </button>
                              ) : null}
                            </div>
                            {isEmpVisible && area.employees.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Equipe:</span>
                                {area.employees.map((emp) => (
                                  <span
                                    key={emp.id}
                                    className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-[11px]"
                                  >
                                    <span className="font-medium text-foreground">{emp.name}</span>
                                    <span className="text-muted-foreground">· {formatHours(emp.hours)}</span>
                                    <span className="text-[10px] opacity-75">({emp.percentageInArea.toFixed(0)}%)</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0 tabular-nums">
                            <div className="w-24 text-right">
                              <span className="text-base font-bold text-foreground block">
                                {formatHours(area.hours)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {area.percentage.toFixed(1)}% do tempo
                              </span>
                            </div>

                            {canSeeCosts && (
                              <div className="w-28 text-right border-l pl-3 hidden sm:block">
                                <span className="text-sm font-semibold text-foreground block">
                                  {area.cost > 0 ? formatCurrency(area.cost) : "—"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatPercent(area.billableShare / 100)} faturável
                                </span>
                              </div>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleAreaExpand(area.name)}
                              className="h-8 w-8 p-0 shrink-0 cursor-pointer"
                              title={isExpanded ? "Ocultar detalhamento da área" : "Ver detalhamento da área"}
                            >
                              {isExpanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                            </Button>
                          </div>
                        </div>

                        {/* Barra de Progresso visual da área */}
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(100, area.percentage)}%` }}
                          />
                        </div>

                        {/* Detalhamento de Colaboradores e Atividades dentro desta Área (Expansível) */}
                        {isExpanded && (
                          <div className="mt-2 grid gap-3.5 rounded-lg border bg-muted/20 p-3.5">
                              {/* 1. Colaboradores na área com horas consolidadas */}
                              <div className="grid gap-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b pb-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleAreaEmployees(area.name)}
                                    className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer text-left"
                                  >
                                    <UsersIcon className="size-3.5 text-primary" />
                                    <span>Colaboradores atuantes em {area.name} ({area.employees.length})</span>
                                    <span className="text-[11px] font-normal text-muted-foreground underline">
                                      {isEmpVisible ? "(Esconder)" : "(Mostrar)"}
                                    </span>
                                  </button>
                                  {isEmpVisible && (
                                    <div className="flex items-center gap-4 shrink-0 tabular-nums text-muted-foreground text-[11px] font-medium">
                                      <span className="w-14 text-right">Horas</span>
                                      <span className="w-14 text-right">Part. %</span>
                                      {canSeeCosts && <span className="w-20 text-right">Custo</span>}
                                    </div>
                                  )}
                                </div>
                                {isEmpVisible && (
                                  <div className="grid gap-1.5">
                                    {area.employees.map((emp) => (
                                      <div
                                        key={emp.id}
                                        className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-card/60 border hover:bg-card transition-colors"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                            {emp.name.charAt(0).toUpperCase()}
                                          </span>
                                          <span className="font-medium truncate text-foreground">{emp.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0 tabular-nums">
                                          <span className="font-semibold text-foreground w-14 text-right">
                                            {formatHours(emp.hours)}
                                          </span>
                                          <span className="text-muted-foreground text-[11px] w-14 text-right">
                                            {emp.percentageInArea.toFixed(1)}%
                                          </span>
                                          {canSeeCosts && (
                                            <span className="text-muted-foreground text-[11px] w-20 text-right">
                                              {emp.cost > 0 ? formatCurrency(emp.cost) : "—"}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* 2. Atividades executadas na área */}
                              <div className="grid gap-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b pb-1.5">
                                  <span className="flex items-center gap-1.5">
                                    <TagIcon className="size-3.5 text-primary" />
                                    Atividades executadas em {area.name} ({area.activities.length}):
                                  </span>
                                  <div className="flex items-center gap-4 shrink-0 tabular-nums text-muted-foreground text-[11px] font-medium">
                                    <span className="w-14 text-right">Horas</span>
                                    <span className="w-14 text-right">Part. %</span>
                                    {canSeeCosts && <span className="w-20 text-right">Custo</span>}
                                  </div>
                                </div>
                                <div className="grid gap-1.5">
                                  {area.activities.map((act) => (
                                    <div
                                      key={act.id}
                                      className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md hover:bg-card/80 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 pr-2">
                                        <span className="font-medium truncate text-foreground">{act.name}</span>
                                        <Badge
                                          variant={act.billable ? "outline" : "secondary"}
                                          className="text-[10px] py-0 px-1 shrink-0"
                                        >
                                          {act.billable ? "Faturável" : "Interna"}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-4 shrink-0 tabular-nums">
                                        <span className="font-semibold text-foreground w-14 text-right">
                                          {formatHours(act.hours)}
                                        </span>
                                        <span className="text-muted-foreground text-[11px] w-14 text-right">
                                          {act.percentageInArea.toFixed(1)}%
                                        </span>
                                        {canSeeCosts && (
                                          <span className="text-muted-foreground text-[11px] w-20 text-right">
                                            {act.cost > 0 ? formatCurrency(act.cost) : "—"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          {/* 2. VISÃO CONSOLIDADA POR ATIVIDADE */}
          {(viewMode === "atividades" || viewMode === "todas") && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <TagIcon className="size-4 text-primary" />
                      <CardTitle className="text-base font-semibold">Atividades Executadas no Cliente</CardTitle>
                      <Badge variant="secondary" className="tabular-nums text-xs">
                        {byActivityDynamic.length} {byActivityDynamic.length === 1 ? "atividade" : "atividades"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Tempo dedicado por tipo de tarefa/atividade individual.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0">
                {byActivityDynamic.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Nenhuma atividade encontrada para os filtros selecionados.
                  </p>
                ) : (
                  byActivityDynamic.map((act) => (
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
                        <div className="flex items-center gap-4 shrink-0 tabular-nums">
                          <span className="font-semibold text-foreground w-14 text-right">{formatHours(act.hours)}</span>
                          <span className="text-xs text-muted-foreground w-14 text-right">
                            {act.percentage.toFixed(1)}%
                          </span>
                          {canSeeCosts && (
                            <span className="text-xs text-muted-foreground w-20 text-right">
                              {act.cost > 0 ? formatCurrency(act.cost) : "—"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Área: <strong className="text-foreground font-normal">{act.areaName}</strong></span>
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
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* 3. VISÃO CONSOLIDADA POR COLABORADOR */}
          {(viewMode === "colaboradores" || viewMode === "todas") && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <UsersIcon className="size-4 text-primary" />
                      <CardTitle className="text-base font-semibold">Equipe Alocada no Cliente</CardTitle>
                      <Badge variant="secondary" className="tabular-nums text-xs">
                        {byEmployeeDynamic.length} {byEmployeeDynamic.length === 1 ? "pessoa" : "pessoas"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Distribuição das horas apontadas entre cada colaborador da equipe.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0">
                {byEmployeeDynamic.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Nenhum colaborador encontrado para os filtros selecionados.
                  </p>
                ) : (
                  byEmployeeDynamic.map((emp) => (
                    <div key={emp.id} className="grid gap-1.5 rounded-lg border p-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {emp.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium truncate">{emp.name}</span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 tabular-nums">
                          <span className="font-semibold text-foreground w-14 text-right">{formatHours(emp.hours)}</span>
                          <span className="text-xs text-muted-foreground w-14 text-right">
                            {emp.percentage.toFixed(1)}%
                          </span>
                          {canSeeCosts && (
                            <span className="text-xs text-muted-foreground w-20 text-right">
                              {emp.cost > 0 ? formatCurrency(emp.cost) : "—"}
                            </span>
                          )}
                        </div>
                      </div>
                      {emp.areas.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span>Áreas:</span>
                          <span className="truncate">{emp.areas.join(", ")}</span>
                        </div>
                      )}
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.min(100, emp.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Extrato Detalhado de Apontamentos (Tabela Completa com Filtros Aplicados) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Extrato Completo de Lançamentos</CardTitle>
                  <CardDescription>
                    Lista item a item de todas as horas apontadas em {selectedClient.name} no período.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                  {isAnyFilterActive && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <RotateCcwIcon className="size-3.5" />
                      Resetar filtros
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsExtratoOpen((prev) => !prev)}
                    className="h-8 gap-1.5 text-xs shadow-xs cursor-pointer"
                  >
                    {isExtratoOpen ? (
                      <>
                        <ChevronUpIcon className="size-3.5" />
                        Esconder extrato
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="size-3.5" />
                        Ver extrato ({filteredEntries.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Barra de resumo dos filtros */}
              <div className="mt-2 flex flex-wrap items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                <span>
                  Mostrando <strong>{filteredEntries.length}</strong> de{" "}
                  <strong>{selectedClient.entriesCount}</strong> apontamentos
                </span>
                <span className="tabular-nums">
                  Total filtrado: <strong className="text-foreground">{formatHours(metrics.hours)}</strong>
                  {canSeeCosts && metrics.cost > 0 ? ` · ${formatCurrency(metrics.cost)}` : ""}
                </span>
              </div>
            </CardHeader>

            {isExtratoOpen && (
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
                            <p className="font-medium leading-tight" title={entry.description ?? undefined}>
                              {entry.activityName}
                            </p>
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
          )}
        </Card>
        </>
      )}
    </div>
  );
}
