import { addDays, businessDaysBetween, startOfWeek } from "@/lib/time";

/** Linha de `public.my_hours_breakdown` (horas do próprio colaborador, sem custo). */
export type MyHoursRow = {
  entry_date: string;
  contract_id: string | null;
  contract_name: string | null;
  client_name: string | null;
  activity_id: string;
  activity_name: string;
  area_id: string | null;
  area_name: string | null;
  billable: boolean;
  hours: number;
};

export type Distribution = { id: string; label: string; hours: number; share: number };

export type PersonalLeave = {
  id?: string;
  start_date: string;
  end_date: string;
  type?: string;
  notes?: string | null;
};

export type PersonalAnalytics = {
  totalHours: number;
  billableHours: number;
  billableShare: number;
  hoursToday: number;
  hoursThisWeek: number;
  /** Jornada esperada até hoje no período (dias úteis de trabalho passados × jornada diária). */
  expectedHours: number;
  /** Jornada esperada no período inteiro (dias úteis de trabalho totais do período × jornada diária). */
  expectedHoursTotal: number;
  expectedToday: number;
  expectedThisWeek: number;
  balance: number;
  byDay: { date: string; hours: number }[];
  byClient: Distribution[];
  byActivity: Distribution[];
  byArea: Distribution[];
  /** Dias úteis do período, até hoje, sem nenhum apontamento e fora de férias/recesso. */
  missingDays: string[];
  /** Dias úteis dentro de períodos de férias/recesso no período avaliado. */
  leaveDays: string[];
  lastEntryDate: string | null;
};

function distribution(rows: MyHoursRow[], key: (row: MyHoursRow) => string, total: number): Distribution[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = key(row);
    map.set(label, (map.get(label) ?? 0) + Number(row.hours));
  }
  return [...map.entries()]
    .map(([label, hours]) => ({ id: label, label, hours, share: total > 0 ? hours / total : 0 }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Consolida as horas do colaborador no período.
 * `dailyTarget` é a jornada diária esperada (jornada mensal ÷ 21 dias úteis).
 * `leaves` lista os períodos de férias ou recessos do colaborador.
 */
export function analyzeMyHours(
  rows: MyHoursRow[],
  period: { from: string; to: string; today: string },
  dailyTarget: number,
  leaves?: PersonalLeave[] | Set<string> | string[],
): PersonalAnalytics {
  const total = rows.reduce((sum, row) => sum + Number(row.hours), 0);
  const billable = rows.filter((row) => row.billable).reduce((sum, row) => sum + Number(row.hours), 0);

  const byDayMap = new Map<string, number>();
  for (const row of rows) {
    byDayMap.set(row.entry_date, (byDayMap.get(row.entry_date) ?? 0) + Number(row.hours));
  }

  // Prepara conjunto de datas em férias/recesso
  const leaveDatesSet = new Set<string>();
  if (leaves) {
    if (leaves instanceof Set) {
      for (const d of leaves) leaveDatesSet.add(d);
    } else if (Array.isArray(leaves)) {
      for (const item of leaves) {
        if (typeof item === "string") {
          leaveDatesSet.add(item);
        } else if (item && typeof item === "object" && item.start_date && item.end_date) {
          const start = item.start_date <= item.end_date ? item.start_date : item.end_date;
          const end = item.start_date <= item.end_date ? item.end_date : item.start_date;
          for (let d = start; d <= end; d = addDays(d, 1)) {
            leaveDatesSet.add(d);
          }
        }
      }
    }
  }

  const weekStart = startOfWeek(period.today);
  const weekEnd = addDays(weekStart, 6);
  const hoursThisWeek = [...byDayMap.entries()]
    .filter(([date]) => date >= weekStart && date <= weekEnd)
    .reduce((sum, [, hours]) => sum + hours, 0);

  const isBusinessDay = (iso: string) => businessDaysBetween(iso, iso) === 1;

  // 1. Mapeia todos os dias úteis do período (from até to) e todos os dias de férias/recesso do período
  const leaveDays: string[] = [];
  let periodTotalWorkingDays = 0;

  for (let day = period.from; day <= period.to; day = addDays(day, 1)) {
    if (isBusinessDay(day)) {
      if (leaveDatesSet.has(day)) {
        leaveDays.push(day);
      } else {
        periodTotalWorkingDays++;
      }
    }
  }

  // 2. Só cobra jornada de dias úteis já passados que não foram férias/recesso (para cálculo do saldo até hoje)
  const limit = period.today < period.to ? period.today : period.to;
  const missingDays: string[] = [];
  let workingBusinessDays = 0;
  let weekWorkingBusinessDays = 0;

  for (let day = period.from; day <= limit; day = addDays(day, 1)) {
    if (isBusinessDay(day)) {
      if (!leaveDatesSet.has(day)) {
        workingBusinessDays++;
        if (day >= weekStart && day <= weekEnd) {
          weekWorkingBusinessDays++;
        }
        if (!byDayMap.has(day)) {
          missingDays.push(day);
        }
      }
    }
  }

  const isTodayBusinessDay = isBusinessDay(period.today);
  const isTodayLeave = leaveDatesSet.has(period.today);
  const expectedToday = isTodayBusinessDay && !isTodayLeave ? dailyTarget : 0;

  const days = [...byDayMap.keys()].sort();

  return {
    totalHours: total,
    billableHours: billable,
    billableShare: total > 0 ? billable / total : 0,
    hoursToday: byDayMap.get(period.today) ?? 0,
    hoursThisWeek,
    expectedHours: workingBusinessDays * dailyTarget,
    expectedHoursTotal: periodTotalWorkingDays * dailyTarget,
    expectedToday,
    expectedThisWeek: weekWorkingBusinessDays * dailyTarget,
    balance: total - workingBusinessDays * dailyTarget,
    byDay: days.map((date) => ({ date, hours: byDayMap.get(date) ?? 0 })),
    byClient: distribution(rows, (row) => row.client_name ?? "Interno", total),
    byActivity: distribution(rows, (row) => row.activity_name, total),
    byArea: distribution(rows, (row) => row.area_name ?? "Sem área", total),
    missingDays,
    leaveDays,
    lastEntryDate: days.at(-1) ?? null,
  };
}
