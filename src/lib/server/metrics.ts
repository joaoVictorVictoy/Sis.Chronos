import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { todayISO } from "@/lib/format";
import { addDays, businessDaysBetween } from "@/lib/time";
import {
  computeProfitability,
  projectClosing,
  suggestedAdjustment,
  sumProfitability,
  type ContractMetricsRow,
} from "@/lib/profitability";
import type { Period } from "@/lib/periods";
import type {
  ClientHoursEntry,
  ClientHoursReport,
  ClientHoursSummary,
  ContractReport,
  MonthPoint,
} from "./metrics.types";

export type { ClientHoursEntry, ClientHoursReport, ClientHoursSummary, ContractReport } from "./metrics.types";

const PAGE_SIZE = 1000;

/** Busca todas as páginas de uma consulta PostgREST/Supabase (que limita respostas a 1000 linhas por padrão). */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data } = await fetchPage(offset, offset + PAGE_SIZE - 1);
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

export type ProfitabilityReport = {
  period: Period;
  contracts: ContractReport[];
  totals: ReturnType<typeof sumProfitability>;
  tolerance: number;
};

/** Relatório de rentabilidade do período (admin/gestor). */
export async function getProfitabilityReport(period: Period): Promise<ProfitabilityReport> {
  const { tenant } = await requireRole(["admin", "gestor"]);
  const supabase = await createClient();

  const { data } = await supabase.rpc("contract_metrics", { p_from: period.from, p_to: period.to });
  const rows = ((data ?? []) as ContractMetricsRow[]).filter((row) => row.contract_status === "ativo");
  const tolerance = Number(tenant.margin_attention_tolerance) || 0;
  const options = { attentionTolerancePoints: tolerance };
  const today = todayISO();

  const contracts: ContractReport[] = rows.map((row) => {
    const profitability = computeProfitability(row, options);
    return {
      row,
      profitability,
      projection: projectClosing(row, profitability, { ...period, today }, options),
      adjustment: suggestedAdjustment(row, profitability),
    };
  });

  contracts.sort((a, b) => b.profitability.profit - a.profitability.profit);

  return {
    period,
    contracts,
    totals: sumProfitability(contracts.map((c) => c.profitability)),
    tolerance,
  };
}

/** Utilização e horas faturáveis por colaborador no período. */
export async function getEmployeeMetrics(period: Period) {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();
  const [{ data: metricsData }, { data: leavesData }] = await Promise.all([
    supabase.rpc("employee_metrics", { p_from: period.from, p_to: period.to }),
    supabase
      .from("employee_leaves")
      .select("employee_id, start_date, end_date, type")
      .lte("start_date", period.to)
      .gte("end_date", period.from),
  ]);

  const activeEmployees = (metricsData ?? []).filter((e) => e.active);
  if (!leavesData || leavesData.length === 0) {
    return activeEmployees;
  }

  // Agrupa dias úteis de afastamento (férias, recesso, folga, atestado, falta, etc.) por colaborador
  const leavesByEmployee = new Map<string, Set<string>>();
  for (const leave of leavesData) {
    const start = leave.start_date <= leave.end_date ? leave.start_date : leave.end_date;
    const end = leave.start_date <= leave.end_date ? leave.end_date : leave.start_date;
    const boundedStart = start < period.from ? period.from : start;
    const boundedEnd = end > period.to ? period.to : end;

    if (boundedStart <= boundedEnd) {
      const set = leavesByEmployee.get(leave.employee_id) ?? new Set<string>();
      for (let d = boundedStart; d <= boundedEnd; d = addDays(d, 1)) {
        if (businessDaysBetween(d, d) === 1) {
          set.add(d);
        }
      }
      leavesByEmployee.set(leave.employee_id, set);
    }
  }

  return activeEmployees.map((emp) => {
    const leaveSet = leavesByEmployee.get(emp.employee_id);
    if (!leaveSet || leaveSet.size === 0) return emp;
    const dailyTarget = Number(emp.available_hours) > 0 ? Number(emp.available_hours) / 21 : 0;
    const leaveHours = Math.round(leaveSet.size * dailyTarget * 10) / 10;
    const adjustedAvailable = Math.max(0, Math.round((Number(emp.available_hours) - leaveHours) * 10) / 10);
    return {
      ...emp,
      available_hours: adjustedAvailable,
    };
  });
}

/** Rentabilidade por área: receita do contrato rateada pelas horas de cada área. */
export async function getAreaReport(period: Period, contracts: ContractReport[]) {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("contract_area_hours", { p_from: period.from, p_to: period.to });
  const rows = data ?? [];

  const hoursByContract = new Map<string, number>();
  for (const row of rows) {
    hoursByContract.set(row.contract_id, (hoursByContract.get(row.contract_id) ?? 0) + Number(row.hours));
  }

  const areas = new Map<string, { name: string; hours: number; laborCost: number; revenue: number }>();
  for (const row of rows) {
    const key = row.area_id ?? "sem-area";
    const entry = areas.get(key) ?? { name: row.area_name, hours: 0, laborCost: 0, revenue: 0 };
    entry.hours += Number(row.hours);
    entry.laborCost += Number(row.labor_cost);

    const contract = contracts.find((c) => c.row.contract_id === row.contract_id);
    const contractHours = hoursByContract.get(row.contract_id) ?? 0;
    if (contract && contractHours > 0) {
      // Rateio proporcional às horas da área dentro do contrato
      entry.revenue += contract.profitability.netRevenue * (Number(row.hours) / contractHours);
    }
    areas.set(key, entry);
  }

  return [...areas.entries()]
    .map(([id, area]) => ({
      id,
      name: area.name,
      hours: area.hours,
      laborCost: area.laborCost,
      revenue: area.revenue,
      profit: area.revenue - area.laborCost,
      margin: area.revenue > 0 ? (area.revenue - area.laborCost) / area.revenue : null,
    }))
    .sort((a, b) => b.profit - a.profit);
}

export async function getActivityMetrics(period: Period) {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("activity_metrics", { p_from: period.from, p_to: period.to });
  return (data ?? []).sort((a, b) => Number(b.labor_cost) - Number(a.labor_cost));
}

export async function getEmployeeClientCost(period: Period) {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("employee_client_cost", { p_from: period.from, p_to: period.to });
  return (data ?? []).sort((a, b) => Number(b.labor_cost) - Number(a.labor_cost));
}

export async function getMissingCosts() {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("employees_missing_cost");
  return data ?? [];
}

export async function getPendingApprovalsCount() {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();
  const { count } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  return count ?? 0;
}

export type { MonthPoint } from "./metrics.types";

/** Evolução mês a mês da empresa (ou de um contrato específico). */
export async function getMonthlyEvolution(
  months: { from: string; to: string; label: string }[],
  contractId?: string,
): Promise<MonthPoint[]> {
  const { tenant } = await requireRole(["admin", "gestor"]);
  const supabase = await createClient();
  const options = { attentionTolerancePoints: Number(tenant.margin_attention_tolerance) || 0 };

  const results = await Promise.all(
    months.map(async (month) => {
      const { data } = await supabase.rpc("contract_metrics", { p_from: month.from, p_to: month.to });
      const rows = ((data ?? []) as ContractMetricsRow[]).filter(
        (row) => !contractId || row.contract_id === contractId,
      );
      const totals = sumProfitability(rows.map((row) => computeProfitability(row, options)));
      return {
        label: month.label,
        revenue: totals.netRevenue,
        cost: totals.totalCost,
        profit: totals.profit,
        margin: totals.realMargin,
        desiredMargin: rows.length ? totals.desiredMargin : null,
        hours: totals.hours,
      };
    }),
  );

  return results;
}

export type TeamMemberReport = {
  id: string;
  name: string;
  active: boolean;
  jobTitle: string | null;
  totalHours: number;
  billableHours: number;
  availableHours: number;
  utilizationPct: number;
  billableShare: number;
  uniqueDays: number;
  dailyAverage: number;
  totalCost: number;
  entries: {
    id: string;
    date: string;
    clientName: string;
    areaName: string;
    activityName: string;
    hours: number;
    cost: number;
    billable: boolean;
    status: string;
  }[];
};

export type TeamOperationalReport = {
  totalHours: number;
  totalAvailableHours: number;
  teamUtilizationPct: number;
  uniqueDaysWorked: number;
  averageDailyHours: number;
  totalLaborCost: number;
  topConsumingActivities: {
    name: string;
    clientName: string;
    areaName: string;
    avgHours: number;
    totalHours: number;
    totalCost: number;
  }[];
  members: TeamMemberReport[];
};

/** Relatório operacional da equipe: blocos de resumo + lista expansível de colaboradores */
export async function getTeamOperationalReport(period: Period): Promise<TeamOperationalReport> {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();

  const [{ data: employeesData }, entriesData, employeeMetrics] = await Promise.all([
    supabase.from("employees").select("id, full_name, active, job_title").order("full_name"),
    fetchAllPages((from, to) =>
      supabase
        .from("time_entries")
        .select(`
          id,
          employee_id,
          entry_date,
          minutes,
          cost_amount,
          billable,
          status,
          activity_id,
          client_id,
          clients(legal_name, trade_name),
          contract_id,
          contracts(name, clients(legal_name, trade_name)),
          activities(id, name, area_id, client_id, areas(name))
        `)
        .gte("entry_date", period.from)
        .lte("entry_date", period.to)
        .neq("status", "rejeitado")
        .order("entry_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    getEmployeeMetrics(period),
  ]);

  const availableByEmployee = new Map<string, number>();
  for (const m of employeeMetrics) {
    availableByEmployee.set(m.employee_id, Number(m.available_hours) || 0);
  }

  const employees = employeesData ?? [];
  const rawEntries = entriesData;

  const activityGroups = new Map<
    string,
    {
      name: string;
      clientName: string;
      areaName: string;
      totalMinutes: number;
      totalCost: number;
      entriesCount: number;
    }
  >();

  const entriesByEmployee = new Map<string, typeof rawEntries>();
  const allUniqueDates = new Set<string>();
  let totalHours = 0;
  let totalLaborCost = 0;

  for (const entry of rawEntries) {
    totalHours += entry.minutes / 60;
    totalLaborCost += Number(entry.cost_amount) || 0;
    allUniqueDates.add(entry.entry_date);

    const list = entriesByEmployee.get(entry.employee_id) ?? [];
    list.push(entry);
    entriesByEmployee.set(entry.employee_id, list);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyE = entry as any;
    const clientName =
      anyE.clients?.trade_name ||
      anyE.clients?.legal_name ||
      anyE.contracts?.clients?.trade_name ||
      anyE.contracts?.clients?.legal_name ||
      "Interno";

    const activityName = anyE.activities?.name || "Atividade";
    const areaName = anyE.activities?.areas?.name || "Sem área";
    const activityKey = `${anyE.activity_id || anyE.activities?.id || activityName}__${clientName}`;

    const existingGroup = activityGroups.get(activityKey);
    if (existingGroup) {
      existingGroup.totalMinutes += entry.minutes;
      existingGroup.totalCost += Number(entry.cost_amount) || 0;
      existingGroup.entriesCount += 1;
    } else {
      activityGroups.set(activityKey, {
        name: activityName,
        clientName,
        areaName,
        totalMinutes: entry.minutes,
        totalCost: Number(entry.cost_amount) || 0,
        entriesCount: 1,
      });
    }
  }

  const topConsumingActivities = Array.from(activityGroups.values())
    .map((g) => ({
      name: g.name,
      clientName: g.clientName,
      areaName: g.areaName,
      avgHours: g.entriesCount > 0 ? g.totalMinutes / 60 / g.entriesCount : 0,
      totalHours: g.totalMinutes / 60,
      totalCost: g.totalCost,
    }))
    .sort((a, b) => b.avgHours - a.avgHours)
    .slice(0, 10);

  const uniqueDaysWorked = allUniqueDates.size;
  const averageDailyHours = uniqueDaysWorked > 0 ? totalHours / uniqueDaysWorked : 0;

  const members: TeamMemberReport[] = employees.map((emp) => {
    const empEntries = entriesByEmployee.get(emp.id) ?? [];
    const empDays = new Set(empEntries.map((e) => e.entry_date)).size;
    const empHours = empEntries.reduce((acc, e) => acc + e.minutes / 60, 0);
    const empBillableHours = empEntries.reduce(
      (acc, e) => acc + (e.billable ? e.minutes / 60 : 0),
      0,
    );
    const empAvailableHours = availableByEmployee.get(emp.id) ?? 0;
    const utilizationPct = empAvailableHours > 0 ? empHours / empAvailableHours : 0;
    const billableShare = empHours > 0 ? empBillableHours / empHours : 0;
    const empCost = empEntries.reduce((acc, e) => acc + (Number(e.cost_amount) || 0), 0);
    const dailyAverage = empDays > 0 ? empHours / empDays : 0;

    const formattedEntries = empEntries.map((e) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyE = e as any;
      const clientName =
        anyE.clients?.trade_name ||
        anyE.clients?.legal_name ||
        anyE.contracts?.clients?.trade_name ||
        anyE.contracts?.clients?.legal_name ||
        "Interno";

      const areaName = anyE.activities?.areas?.name || "Sem área";
      const activityName = anyE.activities?.name || "Atividade";

      return {
        id: e.id,
        date: e.entry_date,
        clientName,
        areaName,
        activityName,
        hours: e.minutes / 60,
        cost: Number(e.cost_amount) || 0,
        billable: e.billable,
        status: e.status,
      };
    });

    return {
      id: emp.id,
      name: emp.full_name,
      active: emp.active,
      jobTitle: emp.job_title,
      totalHours: empHours,
      billableHours: empBillableHours,
      availableHours: empAvailableHours,
      utilizationPct,
      billableShare,
      uniqueDays: empDays,
      dailyAverage,
      totalCost: empCost,
      entries: formattedEntries,
    };
  });

  members.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.totalHours - a.totalHours;
  });

  const activeMembers = members.filter((m) => m.active);
  const activeHours = activeMembers.reduce((sum, m) => sum + m.totalHours, 0);
  const totalAvailableHours = activeMembers.reduce((sum, m) => sum + m.availableHours, 0);
  const teamUtilizationPct = totalAvailableHours > 0 ? activeHours / totalAvailableHours : 0;

  return {
    totalHours,
    totalAvailableHours,
    teamUtilizationPct,
    uniqueDaysWorked,
    averageDailyHours,
    totalLaborCost,
    topConsumingActivities,
    members,
  };
}

/** Relatório consolidado de horas apontadas por cliente no período selecionado (admin/gestor). */
export async function getClientHoursReport(period: Period): Promise<ClientHoursReport> {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();

  const [{ data: clientsData }, entriesData] = await Promise.all([
    supabase.from("clients").select("id, legal_name, trade_name, active").order("trade_name"),
    fetchAllPages((from, to) =>
      supabase
        .from("time_entries")
        .select(`
          id,
          employee_id,
          entry_date,
          start_time,
          end_time,
          minutes,
          description,
          billable,
          status,
          cost_amount,
          activity_id,
          client_id,
          contract_id,
          clients(id, legal_name, trade_name),
          contracts(id, name, client_id, clients(id, legal_name, trade_name)),
          activities(id, name, area_id, client_id, areas(name)),
          employees(id, full_name)
        `)
        .gte("entry_date", period.from)
        .lte("entry_date", period.to)
        .neq("status", "rejeitado")
        .order("entry_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const clients = clientsData ?? [];
  const rawEntries = entriesData;

  // Indexa clientes cadastrados por id
  const clientMap = new Map<string, { id: string; name: string; legalName: string; active: boolean }>();
  for (const c of clients) {
    clientMap.set(c.id, {
      id: c.id,
      name: c.trade_name || c.legal_name,
      legalName: c.legal_name,
      active: c.active,
    });
  }

  // Agrupamento de entradas por cliente
  const entriesByClient = new Map<string, typeof rawEntries>();
  let totalCompanyMinutes = 0;

  for (const entry of rawEntries) {
    totalCompanyMinutes += entry.minutes;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyE = entry as any;
    const resolvedClientId =
      anyE.client_id ||
      anyE.contracts?.client_id ||
      (anyE.clients?.id as string | undefined) ||
      "sem-cliente";

    // Se o cliente não estava na lista (ex: "sem-cliente" ou cliente não encontrado)
    if (!clientMap.has(resolvedClientId)) {
      const fallbackName =
        anyE.clients?.trade_name ||
        anyE.clients?.legal_name ||
        anyE.contracts?.clients?.trade_name ||
        anyE.contracts?.clients?.legal_name ||
        (resolvedClientId === "sem-cliente" ? "Atividades Internas / Sem Cliente" : "Cliente");

      clientMap.set(resolvedClientId, {
        id: resolvedClientId,
        name: fallbackName,
        legalName: fallbackName,
        active: true,
      });
    }

    const list = entriesByClient.get(resolvedClientId) ?? [];
    list.push(entry);
    entriesByClient.set(resolvedClientId, list);
  }

  const clientSummaries: ClientHoursSummary[] = Array.from(clientMap.values()).map((c) => {
    const entries = entriesByClient.get(c.id) ?? [];
    let totalMinutes = 0;
    let billableMinutes = 0;
    let totalCost = 0;

    const empMap = new Map<string, { id: string; name: string; minutes: number; cost: number }>();
    const areaMap = new Map<
      string,
      {
        name: string;
        minutes: number;
        cost: number;
        billableMinutes: number;
        entriesCount: number;
        activityIds: Set<string>;
      }
    >();
    const actMap = new Map<
      string,
      { id: string; name: string; areaName: string; minutes: number; billable: boolean }
    >();
    const conMap = new Map<string, { id: string; name: string; minutes: number }>();

    const mappedEntries: ClientHoursEntry[] = [];

    for (const entry of entries) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyE = entry as any;
      const mins = entry.minutes;
      const cost = Number(entry.cost_amount) || 0;
      totalMinutes += mins;
      if (entry.billable) billableMinutes += mins;
      totalCost += cost;

      const empId = entry.employee_id;
      const empName = anyE.employees?.full_name || "Colaborador";
      const existingEmp = empMap.get(empId) ?? { id: empId, name: empName, minutes: 0, cost: 0 };
      existingEmp.minutes += mins;
      existingEmp.cost += cost;
      empMap.set(empId, existingEmp);

      const actId = entry.activity_id;
      const actName = anyE.activities?.name || "Atividade";
      const areaName = anyE.activities?.areas?.name || "Sem área";
      const existingAct = actMap.get(actId) ?? {
        id: actId,
        name: actName,
        areaName,
        minutes: 0,
        billable: entry.billable,
      };
      existingAct.minutes += mins;
      actMap.set(actId, existingAct);

      const existingArea = areaMap.get(areaName) ?? {
        name: areaName,
        minutes: 0,
        cost: 0,
        billableMinutes: 0,
        entriesCount: 0,
        activityIds: new Set<string>(),
      };
      existingArea.minutes += mins;
      existingArea.cost += cost;
      if (entry.billable) existingArea.billableMinutes += mins;
      existingArea.entriesCount += 1;
      existingArea.activityIds.add(actId);
      areaMap.set(areaName, existingArea);

      const conId = entry.contract_id;
      if (conId) {
        const conName = anyE.contracts?.name || "Contrato";
        const existingCon = conMap.get(conId) ?? { id: conId, name: conName, minutes: 0 };
        existingCon.minutes += mins;
        conMap.set(conId, existingCon);
      }

      mappedEntries.push({
        id: entry.id,
        entryDate: entry.entry_date,
        startTime: entry.start_time,
        endTime: entry.end_time,
        minutes: mins,
        hours: mins / 60,
        description: entry.description,
        billable: entry.billable,
        status: entry.status,
        costAmount: cost,
        employeeId: empId,
        employeeName: empName,
        activityId: actId,
        activityName: actName,
        areaName,
        contractId: conId,
        contractName: conId ? anyE.contracts?.name || null : null,
      });
    }

    const byEmployee = Array.from(empMap.values())
      .map((e) => ({
        id: e.id,
        name: e.name,
        minutes: e.minutes,
        hours: e.minutes / 60,
        cost: e.cost,
        percentage: totalMinutes > 0 ? (e.minutes / totalMinutes) * 100 : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    const byArea = Array.from(areaMap.values())
      .map((a) => ({
        name: a.name,
        minutes: a.minutes,
        hours: a.minutes / 60,
        cost: a.cost,
        billableMinutes: a.billableMinutes,
        billableHours: a.billableMinutes / 60,
        percentage: totalMinutes > 0 ? (a.minutes / totalMinutes) * 100 : 0,
        entriesCount: a.entriesCount,
        activitiesCount: a.activityIds.size,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    const byActivity = Array.from(actMap.values())
      .map((a) => ({
        id: a.id,
        name: a.name,
        areaName: a.areaName,
        minutes: a.minutes,
        hours: a.minutes / 60,
        billable: a.billable,
        percentage: totalMinutes > 0 ? (a.minutes / totalMinutes) * 100 : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    const byContract = Array.from(conMap.values())
      .map((k) => ({
        id: k.id,
        name: k.name,
        minutes: k.minutes,
        hours: k.minutes / 60,
        percentage: totalMinutes > 0 ? (k.minutes / totalMinutes) * 100 : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return {
      id: c.id,
      name: c.name,
      legalName: c.legalName,
      active: c.active,
      totalMinutes,
      totalHours: totalMinutes / 60,
      billableMinutes,
      billableHours: billableMinutes / 60,
      nonBillableHours: (totalMinutes - billableMinutes) / 60,
      billableShare: totalMinutes > 0 ? billableMinutes / totalMinutes : 0,
      totalCost,
      entriesCount: mappedEntries.length,
      employeesCount: byEmployee.length,
      byEmployee,
      byArea,
      byActivity,
      byContract,
      entries: mappedEntries,
    };
  });

  // Ordena os clientes: quem tem mais horas primeiro, depois alfabético
  clientSummaries.sort((a, b) => {
    if (a.totalMinutes !== b.totalMinutes) {
      return b.totalMinutes - a.totalMinutes;
    }
    return a.name.localeCompare(b.name);
  });

  return {
    period: {
      from: period.from,
      to: period.to,
      label: period.label,
    },
    clients: clientSummaries,
    totalCompanyHours: totalCompanyMinutes / 60,
  };
}
