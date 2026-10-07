import { addDays, businessDaysBetween, startOfMonth } from "@/lib/time";
import { todayISO } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/database.types";
import { isManager } from "@/lib/auth/session.shared";

export interface PendingCounts {
  missingDaysCount: number;
  pendingApprovalsCount: number;
}

/**
 * Retorna a lista de datas (ISO string) de dias úteis entre `from` e `to`
 * que não possuem apontamentos nem estão cobertos por férias ou recessos.
 */
export function getMissingBusinessDaysList(
  entryDates: string[],
  leaves: Array<{ start_date: string; end_date: string }>,
  from: string,
  to: string,
): string[] {
  const datesWithEntries = new Set(entryDates);
  const leaveDates = new Set<string>();

  for (const leave of leaves) {
    const start = leave.start_date <= leave.end_date ? leave.start_date : leave.end_date;
    const end = leave.start_date <= leave.end_date ? leave.end_date : leave.start_date;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      leaveDates.add(d);
    }
  }

  const isBusinessDay = (iso: string) => businessDaysBetween(iso, iso) === 1;

  const missing: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (isBusinessDay(d)) {
      if (!leaveDates.has(d) && !datesWithEntries.has(d)) {
        missing.push(d);
      }
    }
  }

  return missing;
}

/**
 * Calcula quantos dias úteis entre `from` e `to` não possuem apontamentos
 * nem estão cobertos por férias ou recessos.
 */
export function calculateMissingBusinessDays(
  entryDates: string[],
  leaves: Array<{ start_date: string; end_date: string }>,
  from: string,
  to: string,
): number {
  return getMissingBusinessDaysList(entryDates, leaves, from, to).length;
}

/**
 * Obtém os dias úteis pendentes de apontamento do colaborador no mês atual.
 */
export async function getEmployeeMissingDays(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<string[]> {
  const today = todayISO();
  const monthStart = startOfMonth(today);

  const [entriesRes, leavesRes] = await Promise.all([
    supabase
      .from("time_entries")
      .select("entry_date")
      .eq("employee_id", employeeId)
      .gte("entry_date", monthStart)
      .lte("entry_date", today),
    supabase
      .from("employee_leaves")
      .select("start_date, end_date")
      .eq("employee_id", employeeId)
      .lte("start_date", today)
      .gte("end_date", monthStart),
  ]);

  const entryDates = (entriesRes.data ?? []).map((e: { entry_date: string }) => e.entry_date);
  const leaves = (leavesRes.data ?? []) as Array<{ start_date: string; end_date: string }>;
  return getMissingBusinessDaysList(entryDates, leaves, monthStart, today);
}

/**
 * Consulta o Supabase para obter o número de pendências:
 * 1. Dias úteis sem apontamento do colaborador logado (mês corrente até hoje)
 * 2. Apontamentos pendentes de aprovação (se o usuário for gestor ou admin)
 */
export async function getPendingCounts(params: {
  supabase: SupabaseClient;
  tenantId: string;
  employeeId?: string | null;
  role: AppRole;
}): Promise<PendingCounts> {
  const { supabase, tenantId, employeeId, role } = params;
  const today = todayISO();
  const monthStart = startOfMonth(today);

  let missingDaysCount = 0;
  let pendingApprovalsCount = 0;

  // 1. Dias úteis sem apontamento
  if (employeeId) {
    const [entriesRes, leavesRes] = await Promise.all([
      supabase
        .from("time_entries")
        .select("entry_date")
        .eq("employee_id", employeeId)
        .gte("entry_date", monthStart)
        .lte("entry_date", today),
      supabase
        .from("employee_leaves")
        .select("start_date, end_date")
        .eq("employee_id", employeeId)
        .lte("start_date", today)
        .gte("end_date", monthStart),
    ]);

    const entryDates = (entriesRes.data ?? []).map((e: { entry_date: string }) => e.entry_date);
    const leaves = (leavesRes.data ?? []) as Array<{ start_date: string; end_date: string }>;
    missingDaysCount = calculateMissingBusinessDays(entryDates, leaves, monthStart, today);
  }

  // 2. Apontamentos pendentes de aprovação (para gestor ou administrador)
  if (isManager(role)) {
    const res = await supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pendente");

    pendingApprovalsCount = res.count ?? 0;
  }

  return {
    missingDaysCount,
    pendingApprovalsCount,
  };
}

