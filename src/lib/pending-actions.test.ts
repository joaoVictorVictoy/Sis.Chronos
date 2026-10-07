import { describe, expect, it } from "vitest";
import { calculateMissingBusinessDays } from "./pending-actions";

describe("calculateMissingBusinessDays", () => {
  it("calcula dias úteis sem apontamentos desconsiderando finais de semana", () => {
    // 2026-10-01 (qui) a 2026-10-07 (qua)
    // Dias úteis: 01, 02, 05, 06, 07 (5 dias úteis)
    const entries = ["2026-10-01", "2026-10-02"];
    const leaves: Array<{ start_date: string; end_date: string }> = [];

    const missing = calculateMissingBusinessDays(entries, leaves, "2026-10-01", "2026-10-07");
    // Faltam: 05, 06, 07 (3 dias)
    expect(missing).toBe(3);
  });

  it("não considera como faltante os dias de férias ou recessos", () => {
    // Dias úteis: 01, 02, 05, 06, 07
    const entries = ["2026-10-01"];
    const leaves = [
      { start_date: "2026-10-05", end_date: "2026-10-06" }, // 05 e 06 são férias
    ];

    const missing = calculateMissingBusinessDays(entries, leaves, "2026-10-01", "2026-10-07");
    // 01 tem apontamento, 05 e 06 são férias -> faltam 02 e 07 (2 dias)
    expect(missing).toBe(2);
  });

  it("retorna 0 quando todos os dias úteis possuem apontamentos ou férias", () => {
    const entries = ["2026-10-01", "2026-10-02", "2026-10-07"];
    const leaves = [{ start_date: "2026-10-05", end_date: "2026-10-06" }];

    const missing = calculateMissingBusinessDays(entries, leaves, "2026-10-01", "2026-10-07");
    expect(missing).toBe(0);
  });
});
