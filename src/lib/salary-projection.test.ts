import { describe, expect, it } from "vitest";
import { calculateSalaryProjection } from "./salary-projection";

describe("calculateSalaryProjection", () => {
  it("calcula horas apontadas, restantes e progresso corretamente", () => {
    const result = calculateSalaryProjection({
      baseSalary: 3000,
      monthlyHours: 120,
      hoursLogged: 30,
      leaves: [],
      monthISO: "2026-10-01",
    });

    expect(result.hoursLogged).toBe(30);
    expect(result.hoursRemaining).toBe(90);
    expect(result.progressPercent).toBe(25);
    expect(result.absenceDaysCount).toBe(0);
    expect(result.absenceDeduction).toBe(0);
    expect(result.expectedSalary).toBe(3000);
  });

  it("calcula dedução proporcional quando há falta no mês", () => {
    const result = calculateSalaryProjection({
      baseSalary: 2100, // diária = 100
      monthlyHours: 120,
      hoursLogged: 10,
      leaves: [
        { start_date: "2026-10-05", end_date: "2026-10-05", type: "falta" },
      ],
      monthISO: "2026-10-01",
    });

    expect(result.absenceDaysCount).toBe(1);
    expect(result.dailyRate).toBe(100);
    expect(result.absenceDeduction).toBe(100);
    expect(result.expectedSalary).toBe(2000);
  });

  it("não desconta férias ou recesso no cálculo de faltas", () => {
    const result = calculateSalaryProjection({
      baseSalary: 2100,
      monthlyHours: 120,
      hoursLogged: 20,
      leaves: [
        { start_date: "2026-10-05", end_date: "2026-10-06", type: "ferias" },
      ],
      monthISO: "2026-10-01",
    });

    expect(result.absenceDaysCount).toBe(0);
    expect(result.absenceDeduction).toBe(0);
    expect(result.expectedSalary).toBe(2100);
  });

  it("lida graciosamente com ausência de dados de salário", () => {
    const result = calculateSalaryProjection({
      baseSalary: null,
      monthlyHours: 120,
      hoursLogged: 40,
    });

    expect(result.hasSalaryData).toBe(false);
    expect(result.hoursRemaining).toBe(80);
    expect(result.expectedSalary).toBe(0);
  });
});
