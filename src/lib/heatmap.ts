import { addDays, businessDaysBetween, startOfWeek } from "@/lib/time";

export type HeatmapRawEntry = {
  entry_date: string;
  client_name: string | null;
  hours: number;
  billable: boolean;
};

export type HeatmapRawLeave = {
  start_date: string;
  end_date: string;
  type?: string;
  notes?: string | null;
};

export type DayClientShare = {
  clientName: string;
  hours: number;
  percentage: number;
};

export type DayHeatmapData = {
  date: string;
  totalHours: number;
  isLeave: boolean;
  leaveType?: string;
  isBusinessDay: boolean;
  byClient: DayClientShare[];
  level: 0 | 1 | 2 | 3 | 4;
};

export type HeatmapWeek = {
  weekIndex: number;
  days: (DayHeatmapData | null)[];
};

export type HeatmapKpis = {
  activeDays: number;
  totalHours: number;
  averageDailyHours: number;
  topClient: { name: string; hours: number } | null;
  billableHours: number;
  billablePercent: number;
  businessDaysCount: number;
};

/** Determina o nível de calor visual baseado nas horas trabalhadas. */
export function getHourLevel(hours: number): 0 | 1 | 2 | 3 | 4 {
  if (hours <= 0) return 0;
  if (hours <= 2) return 1;
  if (hours <= 5) return 2;
  if (hours <= 8) return 3;
  return 4;
}

/**
 * Agrupa os lançamentos por data e calcula o detalhamento de cada cliente no dia.
 */
export function buildDayHeatmapMap(
  entries: HeatmapRawEntry[],
  leaves: HeatmapRawLeave[],
  fromDate: string,
  toDate: string,
): Map<string, DayHeatmapData> {
  const map = new Map<string, DayHeatmapData>();

  // Processa as férias e recessos
  const leavesMap = new Map<string, string>();
  for (const leave of leaves) {
    const s = leave.start_date <= leave.end_date ? leave.start_date : leave.end_date;
    const e = leave.start_date <= leave.end_date ? leave.end_date : leave.start_date;
    for (let d = s; d <= e; d = addDays(d, 1)) {
      leavesMap.set(d, leave.type || "ferias");
    }
  }

  // Inicializa todos os dias do período
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    const isBusiness = businessDaysBetween(d, d) === 1;
    const isLeave = leavesMap.has(d);
    map.set(d, {
      date: d,
      totalHours: 0,
      isLeave,
      leaveType: leavesMap.get(d),
      isBusinessDay: isBusiness,
      byClient: [],
      level: 0,
    });
  }

  // Agrega as horas por cliente no dia
  const dayClientsMap = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    if (entry.entry_date < fromDate || entry.entry_date > toDate) continue;

    let dayClients = dayClientsMap.get(entry.entry_date);
    if (!dayClients) {
      dayClients = new Map<string, number>();
      dayClientsMap.set(entry.entry_date, dayClients);
    }

    const client = entry.client_name?.trim() || "Interno / Sem cliente";
    dayClients.set(client, (dayClients.get(client) || 0) + Number(entry.hours));
  }

  // Preenche dados consolidados
  for (const [date, clientHours] of dayClientsMap.entries()) {
    const dayData = map.get(date);
    if (!dayData) continue;

    let total = 0;
    const clientList: { clientName: string; hours: number }[] = [];
    for (const [name, h] of clientHours.entries()) {
      total += h;
      clientList.push({ clientName: name, hours: h });
    }

    // Ordena do cliente com mais horas para o menor
    clientList.sort((a, b) => b.hours - a.hours);

    dayData.totalHours = total;
    dayData.level = getHourLevel(total);
    dayData.byClient = clientList.map((c) => ({
      clientName: c.clientName,
      hours: c.hours,
      percentage: total > 0 ? (c.hours / total) * 100 : 0,
    }));
  }

  return map;
}

/**
 * Organiza os dias em semanas (colunas) para exibição em grid matricial.
 * Começa na segunda-feira da primeira semana até o domingo da última semana.
 */
export function buildHeatmapWeeks(
  dayMap: Map<string, DayHeatmapData>,
  fromDate: string,
  toDate: string,
): HeatmapWeek[] {
  const firstMonday = startOfWeek(fromDate);
  const lastMonday = startOfWeek(toDate);
  const lastSunday = addDays(lastMonday, 6);

  const weeks: HeatmapWeek[] = [];
  let currentMonday = firstMonday;
  let weekIdx = 0;

  while (currentMonday <= lastSunday) {
    const daysOfWeek: (DayHeatmapData | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(currentMonday, i);
      if (d < fromDate || d > toDate) {
        // Fora do intervalo consultado: exibe vazio/placeholder
        daysOfWeek.push(null);
      } else {
        daysOfWeek.push(dayMap.get(d) || null);
      }
    }

    weeks.push({
      weekIndex: weekIdx++,
      days: daysOfWeek,
    });

    currentMonday = addDays(currentMonday, 7);
  }

  return weeks;
}

/**
 * Calcula os KPIs do período exibido.
 */
export function calculateHeatmapKpis(
  dayMap: Map<string, DayHeatmapData>,
  entries: HeatmapRawEntry[],
  fromDate: string,
  toDate: string,
): HeatmapKpis {
  let activeDays = 0;
  let totalHours = 0;
  let businessDaysCount = 0;

  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    const day = dayMap.get(d);
    if (!day) continue;
    if (day.isBusinessDay) businessDaysCount++;
    if (day.totalHours > 0) {
      activeDays++;
      totalHours += day.totalHours;
    }
  }

  // Identifica o cliente principal
  const clientTotals = new Map<string, number>();
  let billableHours = 0;

  for (const entry of entries) {
    if (entry.entry_date < fromDate || entry.entry_date > toDate) continue;
    const h = Number(entry.hours);
    if (entry.billable) billableHours += h;

    const client = entry.client_name?.trim() || "Interno / Sem cliente";
    clientTotals.set(client, (clientTotals.get(client) || 0) + h);
  }

  let topClient: { name: string; hours: number } | null = null;
  let maxHours = 0;
  for (const [name, h] of clientTotals.entries()) {
    if (h > maxHours) {
      maxHours = h;
      topClient = { name, hours: h };
    }
  }

  return {
    activeDays,
    totalHours,
    averageDailyHours: activeDays > 0 ? totalHours / activeDays : 0,
    topClient,
    billableHours,
    billablePercent: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
    businessDaysCount,
  };
}
