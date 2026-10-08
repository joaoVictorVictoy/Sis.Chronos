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

  it("não desconta férias ou recesso no cálculo de faltas salariais, mas reduz horas a serem trabalhadas", () => {
    // 120h contratadas / 21 = ~5.714h por dia
    // 2 dias úteis de férias (05 e 06/10) = ~11.4h abonadas
    // targetHours = 120 - 11.4 = 108.6h a trabalhar
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
    expect(result.leaveDaysCount).toBe(2);
    expect(result.leaveHours).toBeCloseTo(11.4, 1);
    expect(result.targetHours).toBeCloseTo(108.6, 1);
    expect(result.hoursRemaining).toBeCloseTo(88.6, 1);
  });

  it("reduz horas a serem trabalhadas proporcionalmente ao recesso", () => {
    // 168h contratadas / 21 = 8h por dia
    // 5 dias úteis de recesso = 40h abonadas
    // targetHours = 128h a trabalhar
    const result = calculateSalaryProjection({
      baseSalary: 4200,
      monthlyHours: 168,
      hoursLogged: 100,
      leaves: [
        { start_date: "2026-10-12", end_date: "2026-10-16", type: "recesso" },
      ],
      monthISO: "2026-10-01",
    });

    expect(result.leaveDaysCount).toBe(5);
    expect(result.leaveHours).toBe(40);
    expect(result.targetHours).toBe(128);
    expect(result.hoursRemaining).toBe(28);
    expect(result.progressPercent).toBeCloseTo((100 / 128) * 100, 1);
  });

  it("lida graciosamente com ausência de dados de salário", () => {
    const result = calculateSalaryProjection({
      baseSalary: null,
      monthlyHours: 120,
      hoursLogged: 40,
    });

    expect(result.hasSalaryData).toBe(false);
    expect(result.targetHours).toBe(120);
    expect(result.hoursRemaining).toBe(80);
    expect(result.expectedSalary).toBe(0);
  });
});
