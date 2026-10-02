import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { todayISO } from "@/lib/format";
import {
  computeProfitability,
  projectClosing,
  suggestedAdjustment,
  sumProfitability,
  type ContractMetricsRow,
} from "@/lib/profitability";
import type { Period } from "@/lib/periods";
import type { ContractReport, MonthPoint } from "./metrics.types";

export type { ContractReport } from "./metrics.types";

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
  const rows = (data ?? []) as ContractMetricsRow[];
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
  const { data } = await supabase.rpc("employee_metrics", { p_from: period.from, p_to: period.to });
  return (data ?? []).filter((e) => e.active);
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
  uniqueDaysWorked: number;
  averageDailyHours: number;
  totalLaborCost: number;
  topConsumingActivities: {
    name: string;
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

  const [{ data: employeesData }, { data: entriesData }, { data: activitiesData }] = await Promise.all([
    supabase.from("employees").select("id, full_name, active, job_title").order("full_name"),
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
        client_id,
        clients(legal_name, trade_name),
        contract_id,
        contracts(name, clients(legal_name, trade_name)),
        activities(name, area_id, areas(name))
      `)
      .gte("entry_date", period.from)
      .lte("entry_date", period.to)
      .neq("status", "rejeitado")
      .order("entry_date", { ascending: false }),
    supabase.rpc("activity_metrics", { p_from: period.from, p_to: period.to }),
  ]);

  const employees = employeesData ?? [];
  const rawEntries = entriesData ?? [];

  const topConsumingActivities = (activitiesData ?? [])
    .map((a) => ({
      name: a.activity_name,
      areaName: a.area_name,
      avgHours: Number(a.avg_hours) || (a.entries_count > 0 ? Number(a.hours) / a.entries_count : 0),
      totalHours: Number(a.hours),
      totalCost: Number(a.labor_cost),
    }))
    .sort((a, b) => b.avgHours - a.avgHours)
    .slice(0, 5);

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
  }

  const uniqueDaysWorked = allUniqueDates.size;
  const averageDailyHours = uniqueDaysWorked > 0 ? totalHours / uniqueDaysWorked : 0;

  const members: TeamMemberReport[] = employees.map((emp) => {
    const empEntries = entriesByEmployee.get(emp.id) ?? [];
    const empDays = new Set(empEntries.map((e) => e.entry_date)).size;
    const empHours = empEntries.reduce((acc, e) => acc + e.minutes / 60, 0);
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

  return {
    totalHours,
    uniqueDaysWorked,
    averageDailyHours,
    totalLaborCost,
    topConsumingActivities,
    members,
  };
}
