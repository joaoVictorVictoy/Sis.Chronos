import { describe, expect, it } from "vitest";
import { formatCnpj, formatCurrency, formatDate, formatHours, formatPercent, todayISO } from "@/lib/format";
import { isValidCnpj } from "./cnpj";
import { decimalSchema, optionalCnpjSchema, signupSchema, tenantSettingsSchema, terminateContractSchema } from "./schemas";

describe("CNPJ", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
  });

  it("schema opcional normaliza", () => {
    expect(optionalCnpjSchema.parse("")).toBeNull();
    expect(optionalCnpjSchema.parse("11.222.333/0001-81")).toBe("11222333000181");
    expect(optionalCnpjSchema.safeParse("11.222.333/0001-00").success).toBe(false);
  });
});

describe("números", () => {
  it("aceita formato brasileiro", () => {
    expect(decimalSchema.parse("1.234,56")).toBe(1234.56);
    expect(decimalSchema.parse("168")).toBe(168);
    expect(decimalSchema.parse("12.5")).toBe(12.5);
    expect(decimalSchema.safeParse("abc").success).toBe(false);
  });

  it("configurações da empresa", () => {
    const ok = tenantSettingsSchema.safeParse({
      name: "Empresa",
      cnpj: "",
      monthlyHours: "168",
      marginAttentionTolerance: "10,5",
    });
    expect(ok.success && ok.data).toEqual({ name: "Empresa", cnpj: null, monthlyHours: 168, marginAttentionTolerance: 10.5 });
    expect(
      tenantSettingsSchema.safeParse({ name: "Empresa", cnpj: "", monthlyHours: "0", marginAttentionTolerance: "10" })
        .success,
    ).toBe(false);
  });

  it("senhas precisam conferir", () => {
    const r = signupSchema.safeParse({ email: "a@b.com", password: "12345678", confirmPassword: "1234567x" });
    expect(r.success).toBe(false);
  });
});

describe("formatação pt-BR", () => {
  it("moeda, percentual, horas e datas", () => {
    expect(formatCurrency(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(formatPercent(0.253)).toBe("25,3%");
    expect(formatHours(7.5)).toBe("7h30");
    expect(formatHours(0.25)).toBe("0h15");
    expect(formatDate("2026-03-01")).toBe("01/03/2026");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("hoje usa o fuso de São Paulo", () => {
    // 02:00 UTC de 01/03 ainda é 28/02 em São Paulo (UTC-3)
    expect(todayISO(new Date("2026-03-01T02:00:00Z"))).toBe("2026-02-28");
  });
});

describe("rescisão e multa contratual", () => {
  it("valida encerramento com multa formatada em pt-BR", () => {
    const res = terminateContractSchema.safeParse({
      contractId: "00000000-0000-0000-0000-000000000001",
      terminationReason: "rescisao_cliente",
      terminatedAt: "2026-10-15",
      terminationPenalty: "5.500,50",
      terminationNotes: "Cliente solicitou cancelamento com aviso prévio",
      deactivateClient: "true",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.terminationPenalty).toBe(5500.5);
      expect(res.data.terminationReason).toBe("rescisao_cliente");
      expect(res.data.deactivateClient).toBe(true);
    }
  });

  it("aceita encerramento sem multa rescisória", () => {
    const res = terminateContractSchema.safeParse({
      contractId: "00000000-0000-0000-0000-000000000001",
      terminationReason: "termino_prazo",
      terminatedAt: "2026-10-15",
      terminationPenalty: "",
      terminationNotes: "",
      deactivateClient: "false",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.terminationPenalty).toBeNull();
    }
  });

  it("valida encerramento com motivo e sub-motivo específicos de Churn", () => {
    const res = terminateContractSchema.safeParse({
      contractId: "00000000-0000-0000-0000-000000000001",
      terminationReason: "rescisao_cliente",
      terminationSubReason: "insatisfacao",
      terminatedAt: "2026-10-15",
      terminationPenalty: "3.000,00",
      terminationNotes: "Gargalo de entrega",
      deactivateClient: "false",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.terminationSubReason).toBe("insatisfacao");
      expect(res.data.terminationPenalty).toBe(3000);
    }
  });

  it("rejeita sub-motivo inválido", () => {
    const res = terminateContractSchema.safeParse({
      contractId: "00000000-0000-0000-0000-000000000001",
      terminationReason: "rescisao_cliente",
      terminationSubReason: "motivo_inexistente",
      terminatedAt: "2026-10-15",
      deactivateClient: "false",
    });
    expect(res.success).toBe(false);
  });
});

