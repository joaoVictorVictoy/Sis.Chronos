/**
 * Utilitários para cálculo de MRR (Receita Recorrente Mensal)
 * e suporte a valores customizados por empresa.
 */

export const DEFAULT_PLAN_PRICES: Record<string, number> = {
  starter: 97,
  pro: 197,
  enterprise: 397,
};

/**
 * Extrai valor customizado de MRR armazenado nas manual_notes.
 * Formato esperado: "[MRR: 450]" ou "[MRR: 450.00]"
 */
export function extractCustomMrr(manualNotes: string | null | undefined): number | null {
  if (!manualNotes) return null;
  const match = manualNotes.match(/\[MRR:\s*(\d+(?:[.,]\d+)?)\]/i);
  if (!match) return null;
  const val = parseFloat(match[1].replace(",", "."));
  return isNaN(val) || val <= 0 ? null : val;
}

/**
 * Atualiza ou remove a tag [MRR: X] dentro de manual_notes,
 * preservando todas as outras anotações de texto livre do usuário.
 */
export function setCustomMrrInNotes(
  manualNotes: string | null | undefined,
  customMrr: number | null | undefined
): string | null {
  const cleaned = (manualNotes ?? "")
    .replace(/\[MRR:\s*(\d+(?:[.,]\d+)?)\]/gi, "")
    .trim();

  if (customMrr === null || customMrr === undefined || isNaN(customMrr) || customMrr <= 0) {
    return cleaned || null;
  }

  return cleaned ? `${cleaned}\n[MRR: ${customMrr}]` : `[MRR: ${customMrr}]`;
}

/**
 * Retorna o MRR mensal atual de uma empresa.
 * Retorna 0 se a empresa não estiver ativa (ex: suspensa, em teste sem plano pago).
 */
export function calculateTenantMrr(tenant: {
  subscription_status: string;
  plan_tier: string;
  manual_notes?: string | null;
}): number {
  if (tenant.subscription_status !== "manual_active" && tenant.subscription_status !== "active") {
    return 0;
  }

  const custom = extractCustomMrr(tenant.manual_notes);
  if (custom !== null) {
    return custom;
  }

  const tier = (tenant.plan_tier || "").toLowerCase();
  return DEFAULT_PLAN_PRICES[tier] ?? DEFAULT_PLAN_PRICES.starter;
}

/**
 * Retorna o valor de referência do plano (mesmo se em teste ou suspensa),
 * útil para projeção de faturamento potencial.
 */
export function getTenantPlanBasePrice(tenant: {
  plan_tier: string;
  manual_notes?: string | null;
}): number {
  const custom = extractCustomMrr(tenant.manual_notes);
  if (custom !== null) {
    return custom;
  }
  const tier = (tenant.plan_tier || "").toLowerCase();
  return DEFAULT_PLAN_PRICES[tier] ?? DEFAULT_PLAN_PRICES.starter;
}
