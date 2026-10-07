import { describe, expect, it } from "vitest";
import {
  buildDayHeatmapMap,
  buildHeatmapWeeks,
  calculateHeatmapKpis,
  getHourLevel,
} from "./heatmap";

describe("Heatmap de Atividade", () => {
  it("determina corretamente os níveis visuais de hora", () => {
    expect(getHourLevel(0)).toBe(0);
    expect(getHourLevel(1.5)).toBe(1);
    expect(getHourLevel(2)).toBe(1);
    expect(getHourLevel(4.5)).toBe(2);
    expect(getHourLevel(5)).toBe(2);
    expect(getHourLevel(7.5)).toBe(3);
    expect(getHourLevel(8)).toBe(3);
    expect(getHourLevel(9)).toBe(4);
  });

  it("agrupa horas por cliente no dia e calcula percentuais", () => {
    const entries = [
      { entry_date: "2026-10-01", client_name: "Cliente A", hours: 4, billable: true },
      { entry_date: "2026-10-01", client_name: "Cliente B", hours: 2, billable: true },
      { entry_date: "2026-10-01", client_name: null, hours: 2, billable: false },
      { entry_date: "2026-10-02", client_name: "Cliente A", hours: 8, billable: true },
    ];
    const leaves = [
      { start_date: "2026-10-05", end_date: "2026-10-06", type: "ferias" },
    ];

    const map = buildDayHeatmapMap(entries, leaves, "2026-10-01", "2026-10-07");

    const day1 = map.get("2026-10-01");
    expect(day1).toBeDefined();
    expect(day1?.totalHours).toBe(8);
    expect(day1?.level).toBe(3);
    expect(day1?.byClient).toHaveLength(3);
    expect(day1?.byClient[0]).toEqual({
      clientName: "Cliente A",
      hours: 4,
      percentage: 50,
    });
    expect(day1?.byClient[1]).toEqual({
      clientName: "Cliente B",
      hours: 2,
      percentage: 25,
    });
    expect(day1?.byClient[2]).toEqual({
      clientName: "Interno / Sem cliente",
      hours: 2,
      percentage: 25,
    });

    const dayLeave = map.get("2026-10-05");
    expect(dayLeave?.isLeave).toBe(true);
    expect(dayLeave?.leaveType).toBe("ferias");
  });

  it("organiza os dias em semanas coerentes", () => {
    const map = buildDayHeatmapMap([], [], "2026-10-01", "2026-10-14");
    const weeks = buildHeatmapWeeks(map, "2026-10-01", "2026-10-14");

    expect(weeks.length).toBeGreaterThanOrEqual(2);
    // Cada semana tem exatamente 7 dias
    for (const w of weeks) {
      expect(w.days).toHaveLength(7);
    }
  });

  it("calcula os KPIs do período", () => {
    const entries = [
      { entry_date: "2026-10-01", client_name: "Cliente A", hours: 5, billable: true },
      { entry_date: "2026-10-02", client_name: "Cliente B", hours: 5, billable: false },
    ];
    const map = buildDayHeatmapMap(entries, [], "2026-10-01", "2026-10-07");
    const kpis = calculateHeatmapKpis(map, entries, "2026-10-01", "2026-10-07");

    expect(kpis.activeDays).toBe(2);
    expect(kpis.totalHours).toBe(10);
    expect(kpis.averageDailyHours).toBe(5);
    expect(kpis.billablePercent).toBe(50);
  });
});
