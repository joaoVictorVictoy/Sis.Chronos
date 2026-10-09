import type { Tables, SubscriptionStatus, BillingMode } from "@/lib/database.types";

export type SubscriptionInfo = {
  isActive: boolean;
  isTrial: boolean;
  daysRemaining: number | null;
  status: SubscriptionStatus;
  billingMode: BillingMode;
  statusLabel: string;
  planTier: string;
  formattedExpiration: string | null;
};

export function getSubscriptionInfo(tenant: Tables<"tenants">): SubscriptionInfo {
  const status = tenant.subscription_status ?? "trialing";
  const billingMode = tenant.billing_mode ?? "manual";
  const planTier = tenant.plan_tier ?? "pro";
  const now = new Date();

  // 1. Empresa explicitamente suspensa
  if (status === "suspended") {
    return {
      isActive: false,
      isTrial: false,
      daysRemaining: null,
      status: "suspended",
      billingMode,
      statusLabel: "Assinatura Suspensa",
      planTier,
      formattedExpiration: null,
    };
  }

  // 2. Modo manual ativo
  if (status === "manual_active") {
    if (tenant.current_period_end) {
      const expirationDate = new Date(tenant.current_period_end);
      const diffDays = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const hasExpired = expirationDate.getTime() < now.getTime();

      return {
        isActive: !hasExpired,
        isTrial: false,
        daysRemaining: Math.max(0, diffDays),
        status: hasExpired ? "past_due" : "manual_active",
        billingMode,
        statusLabel: hasExpired ? "Vencido" : "Ativo (Manual)",
        planTier,
        formattedExpiration: expirationDate.toLocaleDateString("pt-BR"),
      };
    }

    return {
      isActive: true,
      isTrial: false,
      daysRemaining: null,
      status: "manual_active",
      billingMode,
      statusLabel: "Ativo (Manual)",
      planTier,
      formattedExpiration: "Sem prazo (vitalício/recorrente)",
    };
  }

  // 3. Em período de teste (Trial)
  if (status === "trialing") {
    const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : new Date(0);
    const diffDays = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = trialEnd.getTime() <= now.getTime();

    return {
      isActive: !isExpired,
      isTrial: true,
      daysRemaining: Math.max(0, diffDays),
      status: "trialing",
      billingMode,
      statusLabel: isExpired ? "Teste Expirado" : `Em teste (${Math.max(0, diffDays)} dias)`,
      planTier,
      formattedExpiration: trialEnd.toLocaleDateString("pt-BR"),
    };
  }

  // 4. Assinatura ativa (ex: Stripe ou aprovada)
  if (status === "active") {
    let formattedExp = null;
    let daysRemaining = null;
    let isExpired = false;

    if (tenant.current_period_end) {
      const expirationDate = new Date(tenant.current_period_end);
      daysRemaining = Math.max(0, Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      isExpired = expirationDate.getTime() < now.getTime();
      formattedExp = expirationDate.toLocaleDateString("pt-BR");
    }

    return {
      isActive: !isExpired,
      isTrial: false,
      daysRemaining,
      status: isExpired ? "past_due" : "active",
      billingMode,
      statusLabel: isExpired ? "Renovação Pendente" : "Ativo",
      planTier,
      formattedExpiration: formattedExp,
    };
  }

  // 5. Outros status (past_due, canceled)
  return {
    isActive: false,
    isTrial: false,
    daysRemaining: null,
    status,
    billingMode,
    statusLabel: status === "canceled" ? "Cancelado" : "Pagamento Pendente",
    planTier,
    formattedExpiration: tenant.current_period_end
      ? new Date(tenant.current_period_end).toLocaleDateString("pt-BR")
      : null,
  };
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const configured = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return configured.includes(normalized);
}
