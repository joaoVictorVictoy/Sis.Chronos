"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

export async function impersonateTenantAction(tenantId: string) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .single();

  if (tErr || !tenant) {
    throw new Error("Empresa não encontrada.");
  }

  // Busca se o super admin já tem um perfil
  const { data: currentProfile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const cookieStore = await cookies();
  if (currentProfile?.tenant_id && currentProfile.tenant_id !== tenantId) {
    cookieStore.set("sa_original_tenant_id", currentProfile.tenant_id, {
      path: "/",
      httpOnly: true,
      maxAge: 60 * 60 * 24,
    });
  }

  // Atualiza ou insere o perfil do super admin para este tenant com permissão de admin
  const { error: pErr } = await admin.from("profiles").upsert(
    {
      id: user.id,
      tenant_id: tenantId,
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Super Admin",
      email: user.email!,
      role: "admin",
      can_view_costs: true,
      active: true,
    },
    { onConflict: "id" }
  );

  if (pErr) {
    throw new Error("Falha ao configurar suporte: " + pErr.message);
  }

  cookieStore.set("sa_impersonate_active", "true", { path: "/", maxAge: 60 * 60 * 24 });
  cookieStore.set("sa_impersonate_tenant_name", encodeURIComponent(tenant.name), { path: "/", maxAge: 60 * 60 * 24 });
  cookieStore.set("sa_impersonate_tenant_id", tenant.id, { path: "/", maxAge: 60 * 60 * 24 });

  revalidatePath("/", "layout");
  redirect("/inicio");
}

export async function stopImpersonationAction() {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();
  const cookieStore = await cookies();

  const originalTenantId = cookieStore.get("sa_original_tenant_id")?.value;

  if (originalTenantId) {
    await admin
      .from("profiles")
      .update({ tenant_id: originalTenantId })
      .eq("id", user.id);
  }

  cookieStore.delete("sa_impersonate_active");
  cookieStore.delete("sa_impersonate_tenant_name");
  cookieStore.delete("sa_impersonate_tenant_id");
  cookieStore.delete("sa_original_tenant_id");

  revalidatePath("/", "layout");
  redirect("/super-admin");
}

export async function saveAnnouncementAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const type = String(formData.get("type") ?? "info");
  const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "on";

  if (isActive && (!title || !message)) {
    return { error: "Título e mensagem são obrigatórios para ativar o comunicado." };
  }

  try {
    const announcementsTable = (admin as any).from("system_announcements");
    const { data: existing } = await announcementsTable
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error: updErr } = await announcementsTable
        .update({
          title: title || "Aviso do Sistema",
          message,
          type,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updErr) return { error: `Erro ao atualizar comunicado: ${translateError(updErr)}` };
    } else {
      const { error: insErr } = await announcementsTable.insert({
        title: title || "Aviso do Sistema",
        message,
        type,
        is_active: isActive,
      });

      if (insErr) return { error: `Erro ao criar comunicado: ${translateError(insErr)}` };
    }

    revalidatePath("/", "layout");
    revalidatePath("/super-admin");
    return { success: isActive ? "Comunicado publicado com sucesso para todos os usuários!" : "Comunicado desativado com sucesso." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Erro ao salvar comunicado: ${msg}` };
  }
}

