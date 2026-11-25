import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole, Tables } from "@/lib/database.types";
import { getSubscriptionInfo, isSuperAdminEmail, type SubscriptionInfo } from "@/lib/subscription/status";

/**
 * Verifica se um e-mail (ou lista de e-mails) pertence a um Super Admin.
 * Prioriza a tabela `public.super_admins` (quando populada) + `SUPER_ADMIN_EMAILS` da Vercel,
 * permitindo que e-mails removidos pelo painel deixem de ter acesso imediatamente.
 */
export async function checkIsSuperAdminEmail(
  emailOrEmails?: string | null | (string | null | undefined)[],
): Promise<boolean> {
  const list = (Array.isArray(emailOrEmails) ? emailOrEmails : [emailOrEmails])
    .map((e) => e?.trim().toLowerCase())
    .filter((e): e is string => Boolean(e));

  if (list.length === 0) return false;

  // 1. Variável de ambiente explícita (SUPER_ADMIN_EMAILS)
  if (list.some((e) => isSuperAdminEmail(e, { includeDefaults: false }))) {
    return true;
  }

  // 2. Tabela public.super_admins no banco (fonte de verdade gerenciável pelo painel)
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin.from("super_admins").select("email");
    if (!error && rows && rows.length > 0) {
      const dbSet = new Set(rows.map((r) => String(r.email).trim().toLowerCase()));
      return list.some((e) => dbSet.has(e));
    }
  } catch {
    // Fallback abaixo caso service role não esteja disponível em ambiente de teste
  }

  // 3. Fallback seguro apenas se a tabela estiver vazia ou inacessível
  return list.some((e) => isSuperAdminEmail(e, { includeDefaults: true }));
}

export type AppContext = {
  user: User;
  profile: Tables<"profiles">;
  tenant: Tables<"tenants">;
  /** Cadastro de colaborador vinculado ao login (quem aponta horas). */
  employeeId: string | null;
  /** Horas mensais cadastradas para o colaborador; nulo = segue padrão da empresa. */
  employeeMonthlyHours: number | null;
  /** Status da assinatura e licenciamento da empresa. */
  subscription: SubscriptionInfo;
  /** Define se o usuário autenticado é o dono do SaaS (Super Admin). */
  isSuperAdmin: boolean;
};

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Contexto completo do usuário; `null` se ainda não pertence a uma empresa. */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data }, { data: employee }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, tenants(*)")
      .eq("id", user.id)
      .maybeSingle<Tables<"profiles"> & { tenants: Tables<"tenants"> }>(),
    supabase
      .from("employees")
      .select("id, monthly_hours")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  if (!data || !data.tenants) return null;
  const { tenants, ...profile } = data;

  const isSuper = await checkIsSuperAdminEmail([user.email, profile.email]);
  const subscription = getSubscriptionInfo(tenants);

  return {
    user,
    profile,
    tenant: tenants,
    employeeId: employee?.id ?? null,
    employeeMonthlyHours:
      employee?.monthly_hours !== null && employee?.monthly_hours !== undefined
        ? Number(employee.monthly_hours)
        : null,
    subscription,
    isSuperAdmin: isSuper,
  };
});

/** Exige usuário autenticado e vinculado a uma empresa ativa. */
export async function requireContext(): Promise<AppContext> {
  const user = await getUser();
  if (!user) redirect("/login");
  const ctx = await getAppContext();
  if (!ctx) {
    if (await checkIsSuperAdminEmail(user.email)) {
      redirect("/super-admin");
    }
    redirect("/onboarding");
  }
  if (!ctx.profile.active) redirect("/acesso-suspenso");
  if (!ctx.isSuperAdmin && !ctx.subscription.isActive) {
    redirect("/assinatura-suspensa");
  }
  return ctx;
}

export async function requireRole(roles: AppRole[]): Promise<AppContext> {
  const ctx = await requireContext();
  if (!roles.includes(ctx.profile.role)) redirect("/inicio");
  return ctx;
}

export type SuperAdminContext = {
  user: User;
  isSuperAdmin: true;
};

export async function requireSuperAdmin(): Promise<SuperAdminContext> {
  const user = await getUser();
  if (!user) redirect("/super-admin/login");

  const isSuper = await checkIsSuperAdminEmail(user.email);
  if (!isSuper) {
    redirect("/super-admin/login?erro=" + encodeURIComponent("Acesso negado: este usuário não é um administrador do sistema."));
  }

  return { user, isSuperAdmin: true };
}

export { ROLE_LABELS, isManager } from "./session.shared";
