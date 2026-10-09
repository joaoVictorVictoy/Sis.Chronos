"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseForm, type ActionState } from "@/lib/actions";
import { translateError } from "@/lib/auth/errors";
import { emailDomain } from "@/lib/email-domain";
import { createAccessLink } from "@/lib/server/access-link";
import { getOrigin } from "@/lib/server/origin";
import {
  superAdminCreateTenantSchema,
  superAdminUpdateTenantSchema,
} from "@/lib/validation/schemas";

export async function toggleTenantStatusAction(tenantId: string, currentStatus: string) {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const nextStatus = currentStatus === "suspended" ? "manual_active" : "suspended";

  const { error } = await admin
    .from("tenants")
    .update({ subscription_status: nextStatus })
    .eq("id", tenantId);

  if (error) {
    throw new Error(translateError(error));
  }

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
}

export async function extendTrialAction(tenantId: string, daysToAdd: number) {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const newTrialEnd = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from("tenants")
    .update({
      subscription_status: "trialing",
      trial_ends_at: newTrialEnd,
    })
    .eq("id", tenantId);

  if (error) {
    throw new Error(translateError(error));
  }

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
}

export async function deleteTenantAction(tenantId: string) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  // 1. Busca perfis da empresa para limpar usuários do Auth se necessário
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId);

  // 2. Apaga a empresa (o cascade do Postgres apaga automaticamente contratos, colaboradores, apontamentos, etc.)
  const { error } = await admin.from("tenants").delete().eq("id", tenantId);
  if (error) {
    throw new Error(translateError(error));
  }

  // 3. Remove os logins correspondentes do Auth (exceto se for o próprio Super Admin logado)
  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      if (p.id !== user.id) {
        try {
          await admin.auth.admin.deleteUser(p.id);
        } catch {
          // ignora caso o usuário do Auth já não exista mais
        }
      }
    }
  }

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
}

export async function updateTenantSubscriptionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = parseForm(superAdminUpdateTenantSchema, formData);
  if (!parsed.ok) return parsed.state;

  const admin = createAdminClient();

  const { error } = await admin
    .from("tenants")
    .update({
      subscription_status: parsed.data.subscriptionStatus,
      billing_mode: parsed.data.billingMode,
      plan_tier: parsed.data.planTier,
      current_period_end: parsed.data.currentPeriodEnd,
      manual_notes: parsed.data.manualNotes,
    })
    .eq("id", parsed.data.tenantId);

  if (error) return { error: translateError(error) };

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
  return { success: "Assinatura da empresa atualizada com sucesso." };
}

export type CreateTenantResultState = ActionState & {
  accessLink?: string;
};

export async function createTenantByAdminAction(
  _prev: CreateTenantResultState,
  formData: FormData
): Promise<CreateTenantResultState> {
  await requireSuperAdmin();
  const parsed = parseForm(superAdminCreateTenantSchema, formData);
  if (!parsed.ok) return parsed.state;

  const admin = createAdminClient();
  const domain = emailDomain(parsed.data.ownerEmail);

  // 1. Cria a empresa
  const { data: newTenant, error: tenantErr } = await admin
    .from("tenants")
    .insert({
      name: parsed.data.companyName,
      cnpj: parsed.data.cnpj,
      email_domain: domain,
      subscription_status: parsed.data.subscriptionStatus,
      billing_mode: "manual",
      plan_tier: parsed.data.planTier,
      current_period_end: parsed.data.currentPeriodEnd,
      manual_notes: parsed.data.manualNotes,
    })
    .select("id")
    .single();

  if (tenantErr || !newTenant) {
    return { error: tenantErr ? translateError(tenantErr) : "Falha ao criar empresa." };
  }

  // 2. Cria convite de administrador para o responsável
  const { error: invErr } = await admin.from("invitations").insert({
    tenant_id: newTenant.id,
    email: parsed.data.ownerEmail,
    full_name: parsed.data.ownerName,
    role: "admin",
    can_view_costs: true,
  });

  if (invErr) {
    return {
      error: `Empresa criada, mas ocorreu um erro no convite do responsável: ${translateError(invErr)}`,
    };
  }

  // 3. Tenta enviar invite automático e gera o link direto
  try {
    await admin.auth.admin.inviteUserByEmail(parsed.data.ownerEmail);
  } catch {
    // Silencia se o envio nativo falhar, geramos o link de acesso abaixo
  }

  const origin = await getOrigin();
  const accessResult = await createAccessLink(parsed.data.ownerEmail, origin);

  revalidatePath("/super-admin");

  if ("link" in accessResult) {
    return {
      success: `Empresa ${parsed.data.companyName} criada com sucesso!`,
      accessLink: accessResult.link,
    };
  }

  return {
    success: `Empresa ${parsed.data.companyName} criada com sucesso. Convite enviado para ${parsed.data.ownerEmail}.`,
  };
}
