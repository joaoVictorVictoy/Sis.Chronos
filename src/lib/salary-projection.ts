import { addDays, businessDaysBetween, endOfMonth, startOfMonth } from "@/lib/time";

export interface SalaryProjectionInput {
  baseSalary: number | null;
  monthlyHours: number;
  hoursLogged: number;
  leaves?: Array<{
    start_date: string;
    end_date: string;
    type?: string;
  }>;
  monthISO?: string; // YYYY-MM ou data ISO do mês
}

export interface SalaryProjection {
  hasSalaryData: boolean;
  baseSalary: number;
  monthlyHours: number;
  /** Horas efetivas a serem trabalhadas no mês (jornada contratada menos férias/recesso). */
  targetHours: number;
  /** Horas abonadas por férias ou recesso dentro do mês. */
  leaveHours: number;
  /** Quantidade de dias úteis em férias/recesso dentro do mês. */
  leaveDaysCount: number;
  hoursLogged: number;
  hoursRemaining: number;
  progressPercent: number;
  absenceDaysCount: number;
  absenceDeduction: number;
  expectedSalary: number;
  dailyRate: number;
}

/**
 * Calcula a projeção de horas e salário esperado no mês,
 * considerando a jornada contratada, deduções de férias/recesso e eventuais faltas registradas.
 */
export function calculateSalaryProjection(input: SalaryProjectionInput): SalaryProjection {
  const {
    baseSalary,
    monthlyHours,
    hoursLogged,
    leaves = [],
    monthISO,
  } = input;

  // Determina período do mês
  const refDate = monthISO ?? new Date().toISOString().slice(0, 10);
  const mStart = startOfMonth(refDate);
  const mEnd = endOfMonth(refDate);

  // Mapeia dias úteis que foram registrados como falta não remunerada e férias/recesso/afastamentos abonados
  const absenceDates = new Set<string>();
  const leaveDates = new Set<string>();

  for (const leave of leaves) {
    const rawType = (leave.type || "ferias").toLowerCase();
    const start = leave.start_date <= leave.end_date ? leave.start_date : leave.end_date;
    const end = leave.start_date <= leave.end_date ? leave.end_date : leave.start_date;

    const boundedStart = start < mStart ? mStart : start;
    const boundedEnd = end > mEnd ? mEnd : end;

    if (boundedStart <= boundedEnd) {
      for (let d = boundedStart; d <= boundedEnd; d = addDays(d, 1)) {
        if (businessDaysBetween(d, d) === 1) {
          if (rawType === "falta") {
            absenceDates.add(d);
          } else {
            // "ferias", "recesso", "folga", "atestado", "outro"
            leaveDates.add(d);
          }
        }
      }
    }
  }

  const absenceDaysCount = absenceDates.size;
  // Qualquer motivo de ausência registrado (férias, recesso, folga, atestado, falta, outro) deduz da jornada a ser apontada
  const allAbsenceDates = new Set([...leaveDates, ...absenceDates]);
  const leaveDaysCount = allAbsenceDates.size;

  // Horas por dia útil padrão (jornada contratada mensal ÷ 21 dias úteis padrão CLT)
  const dailyHours = monthlyHours > 0 ? monthlyHours / 21 : 0;
  const leaveHours = Math.round(leaveDaysCount * dailyHours * 10) / 10;
  const targetHours = Math.max(0, Math.round((monthlyHours - leaveHours) * 10) / 10);

  const hoursRemaining = Math.max(0, Math.round((targetHours - hoursLogged) * 10) / 10);
  const progressPercent = targetHours > 0 ? Math.min(100, (hoursLogged / targetHours) * 100) : (hoursLogged > 0 ? 100 : 0);

  const hasSalaryData = baseSalary !== null && baseSalary > 0;
  const numBaseSalary = baseSalary ?? 0;

  // Valor diário estimado (base / 21 dias úteis padrão CLT)
  const dailyRate = hasSalaryData ? numBaseSalary / 21 : 0;
  const absenceDeduction = hasSalaryData ? Math.round(absenceDaysCount * dailyRate * 100) / 100 : 0;
  const expectedSalary = hasSalaryData ? Math.max(0, Math.round((numBaseSalary - absenceDeduction) * 100) / 100) : 0;

  return {
    hasSalaryData,
    baseSalary: numBaseSalary,
    monthlyHours,
    targetHours,
    leaveHours,
    leaveDaysCount,
    hoursLogged,
    hoursRemaining,
    progressPercent,
    absenceDaysCount,
    absenceDeduction,
    expectedSalary,
    dailyRate,
  };
}
