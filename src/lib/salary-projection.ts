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
 * considerando a jornada contratada e eventuais faltas registradas.
 */
export function calculateSalaryProjection(input: SalaryProjectionInput): SalaryProjection {
  const {
    baseSalary,
    monthlyHours,
    hoursLogged,
    leaves = [],
    monthISO,
  } = input;

  const hoursRemaining = Math.max(0, monthlyHours - hoursLogged);
  const progressPercent = monthlyHours > 0 ? Math.min(100, (hoursLogged / monthlyHours) * 100) : 0;

  // Determina período do mês para contagem de faltas
  const refDate = monthISO ?? new Date().toISOString().slice(0, 10);
  const mStart = startOfMonth(refDate);
  const mEnd = endOfMonth(refDate);

  // Mapeia dias úteis que foram registrados como falta não remunerada
  const absenceDates = new Set<string>();
  for (const leave of leaves) {
    if (leave.type === "falta") {
      const start = leave.start_date <= leave.end_date ? leave.start_date : leave.end_date;
      const end = leave.start_date <= leave.end_date ? leave.end_date : leave.start_date;
      
      const boundedStart = start < mStart ? mStart : start;
      const boundedEnd = end > mEnd ? mEnd : end;

      for (let d = boundedStart; d <= boundedEnd; d = addDays(d, 1)) {
        if (businessDaysBetween(d, d) === 1) {
          absenceDates.add(d);
        }
      }
    }
  }

  const absenceDaysCount = absenceDates.size;
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
    hoursLogged,
    hoursRemaining,
    progressPercent,
    absenceDaysCount,
    absenceDeduction,
    expectedSalary,
    dailyRate,
  };
}
