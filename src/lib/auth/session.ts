import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Tables } from "@/lib/database.types";
import { getSubscriptionInfo, isSuperAdminEmail, type SubscriptionInfo } from "@/lib/subscription/status";

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

  let isSuperInDb = false;
  const emailsToCheck = [user.email, profile.email].filter(Boolean) as string[];
  for (const e of emailsToCheck) {
    try {
      const { data: sa } = await supabase
        .from("super_admins")
        .select("id")
        .ilike("email", e)
        .maybeSingle();
      if (sa) {
        isSuperInDb = true;
        break;
      }
    } catch {
      // Ignora erro se a tabela ainda não existir
    }
  }

  const isSuper =
    emailsToCheck.some((e) => isSuperAdminEmail(e)) || isSuperInDb;
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
  if (!ctx) redirect("/onboarding");
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

  let isSuperInDb = false;
  if (user.email) {
    try {
      const supabase = await createClient();
      const { data: sa } = await supabase
        .from("super_admins")
        .select("id")
        .ilike("email", user.email)
        .maybeSingle();
      if (sa) isSuperInDb = true;
    } catch {
      isSuperInDb = false;
    }
  }

  const isSuper = isSuperAdminEmail(user.email) || isSuperInDb;
  if (!isSuper) {
    redirect("/super-admin/login?erro=" + encodeURIComponent("Acesso negado: este usuário não é um administrador do sistema."));
  }

  return { user, isSuperAdmin: true };
}

export { ROLE_LABELS, isManager } from "./session.shared";
