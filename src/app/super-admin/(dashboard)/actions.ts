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
import { logAuditEvent } from "./audit";
import { savePlatformSettings } from "./platform-settings";
import { setCustomMrrInNotes } from "@/lib/subscription/mrr";

export async function toggleTenantStatusAction(tenantId: string, currentStatus: string) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const nextStatus = currentStatus === "suspended" ? "manual_active" : "suspended";

  // Busca nome para o log
  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  const { error } = await admin
    .from("tenants")
    .update({ subscription_status: nextStatus })
    .eq("id", tenantId);

  if (error) {
    throw new Error(translateError(error));
  }

  await logAuditEvent({
    action: nextStatus === "suspended" ? "Suspensão de Empresa" : "Reativação de Empresa",
    tenantId,
    tenantName: tenant?.name ?? "Empresa",
    superAdminEmail: user.email!,
    details: `Status alterado de ${currentStatus} para ${nextStatus}.`,
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
}

export async function extendTrialAction(tenantId: string, daysToAdd: number) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

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

  await logAuditEvent({
    action: "Prorrogação de Teste (Trial)",
    tenantId,
    tenantName: tenant?.name ?? "Empresa",
    superAdminEmail: user.email!,
    details: `Teste estendido por mais ${daysToAdd} dias (até ${new Date(newTrialEnd).toLocaleDateString("pt-BR")}).`,
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
}

export async function renewSubscriptionAction(tenantId: string, daysToAdd: number) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  if (!Number.isFinite(daysToAdd) || daysToAdd <= 0) {
    throw new Error("Quantidade de dias para renovação inválida.");
  }

  const { data: tenant, error: fetchErr } = await admin
    .from("tenants")
    .select("name, current_period_end, subscription_status")
    .eq("id", tenantId)
    .single();

  if (fetchErr || !tenant) {
    throw new Error("Empresa não encontrada.");
  }

  const currentEndMs = tenant.current_period_end
    ? new Date(tenant.current_period_end).getTime()
    : 0;
  const baseMs = Math.max(Date.now(), Number.isFinite(currentEndMs) ? currentEndMs : 0);
  const newPeriodEnd = new Date(baseMs + daysToAdd * 86400000).toISOString();

  const { error } = await admin
    .from("tenants")
    .update({
      subscription_status: "manual_active",
      current_period_end: newPeriodEnd,
    })
    .eq("id", tenantId);

  if (error) {
    throw new Error(translateError(error));
  }

  await logAuditEvent({
    action: `Renovação de Assinatura (+${daysToAdd} dias)`,
    tenantId,
    tenantName: tenant.name,
    superAdminEmail: user.email!,
    details: `Assinatura ativada/estendida por +${daysToAdd} dias (novo vencimento: ${new Date(newPeriodEnd).toLocaleDateString("pt-BR")}).`,
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");

  return { newPeriodEnd };
}

export async function deleteTenantAction(tenantId: string) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  const tenantName = tenant?.name ?? "Empresa";

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

  await logAuditEvent({
    action: "Exclusão Definitiva de Empresa",
    tenantId,
    tenantName,
    superAdminEmail: user.email!,
    details: `Empresa ${tenantName} e todos os seus registros foram excluídos permanentemente.`,
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
}

export async function updateTenantSubscriptionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireSuperAdmin();
  const parsed = parseForm(superAdminUpdateTenantSchema, formData);
  if (!parsed.ok) return parsed.state;

  const admin = createAdminClient();

  // Se veio customMrr, atualiza dentro de manualNotes
  const finalNotes = setCustomMrrInNotes(parsed.data.manualNotes, parsed.data.customMrr);

  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", parsed.data.tenantId)
    .single();

  const { error } = await admin
    .from("tenants")
    .update({
      subscription_status: parsed.data.subscriptionStatus,
      billing_mode: parsed.data.billingMode,
      plan_tier: parsed.data.planTier,
      current_period_end: parsed.data.currentPeriodEnd,
      max_users: parsed.data.maxUsers,
      manual_notes: finalNotes,
    })
    .eq("id", parsed.data.tenantId);

  if (error) return { error: translateError(error) };

  await logAuditEvent({
    action: "Atualização de Plano / Assinatura",
    tenantId: parsed.data.tenantId,
    tenantName: tenant?.name ?? "Empresa",
    superAdminEmail: user.email!,
    details: `Plano: ${parsed.data.planTier}, Status: ${parsed.data.subscriptionStatus}, Vagas: ${parsed.data.maxUsers ?? "Ilimitado"}, MRR Custom: ${parsed.data.customMrr ? `R$ ${parsed.data.customMrr}` : "Padrão"}`,
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
  return { success: "Assinatura da empresa atualizada com sucesso." };
}

export async function updateTenantMaxUsersAction(tenantId: string, maxUsers: number | null) {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  const { error } = await admin
    .from("tenants")
    .update({ max_users: maxUsers })
    .eq("id", tenantId);

  if (error) {
    throw new Error(translateError(error));
  }

  await logAuditEvent({
    action: "Alteração de Limite de Vagas",
    tenantId,
    tenantName: tenant?.name ?? "Empresa",
    superAdminEmail: user.email!,
    details: maxUsers ? `Limite alterado para ${maxUsers} usuário(s).` : "Limite liberado (Ilimitado).",
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
}

export type CreateTenantResultState = ActionState & {
  accessLink?: string;
};

export async function createTenantByAdminAction(
  _prev: CreateTenantResultState,
  formData: FormData
): Promise<CreateTenantResultState> {
  const { user } = await requireSuperAdmin();
  const parsed = parseForm(superAdminCreateTenantSchema, formData);
  if (!parsed.ok) return parsed.state;

  const admin = createAdminClient();
  const domain = emailDomain(parsed.data.ownerEmail);

  const finalNotes = setCustomMrrInNotes(parsed.data.manualNotes, parsed.data.customMrr);

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
      max_users: parsed.data.maxUsers,
      manual_notes: finalNotes,
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

  await logAuditEvent({
    action: "Criação de Nova Empresa",
    tenantId: newTenant.id,
    tenantName: parsed.data.companyName,
    superAdminEmail: user.email!,
    details: `Responsável: ${parsed.data.ownerName} (${parsed.data.ownerEmail}), Plano: ${parsed.data.planTier}`,
  });

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

export async function generateAdminAccessLinkAction(
  email: string,
  tenantName?: string,
  tenantId?: string
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const { user } = await requireSuperAdmin();
  const origin = await getOrigin();
  const accessResult = await createAccessLink(email, origin);

  if ("link" in accessResult) {
    await logAuditEvent({
      action: "Link Mágico de Acesso Gerado",
      tenantId,
      tenantName: tenantName || "Empresa",
      superAdminEmail: user.email!,
      details: `Link de login temporário gerado para ${email}`,
    });
    return { ok: true, link: accessResult.link };
  }

  return { ok: false, error: accessResult.error };
}

export type TenantHealthData = {
  clientsCount: number;
  contractsCount: number;
  employeesCount: number;
  activeEmployeesCount: number;
  recentEntriesCount: number;
  recentHoursTotal: number;
  lastEntryDate: string | null;
  status: "engaged" | "low_activity" | "inactive";
};

export async function getTenantHealthAction(tenantId: string): Promise<TenantHealthData> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  // 1. Clientes
  const { count: clientsCount } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  // 2. Contratos
  const { count: contractsCount } = await admin
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  // 3. Colaboradores
  const { data: employees } = await admin
    .from("employees")
    .select("id, active")
    .eq("tenant_id", tenantId);

  const employeesCount = employees?.length ?? 0;
  const activeEmployeesCount = employees?.filter((e) => e.active).length ?? 0;

  // 4. Apontamentos nos últimos 30 dias (paginado para não truncar em 1.000 linhas)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const recentEntries: { id: string; minutes: number; entry_date: string }[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data: page, error: entriesErr } = await admin
      .from("time_entries")
      .select("id, minutes, entry_date")
      .eq("tenant_id", tenantId)
      .gte("entry_date", thirtyDaysAgo)
      .order("entry_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (entriesErr) {
      throw new Error(translateError(entriesErr));
    }

    if (!page || page.length === 0) break;
    recentEntries.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const recentEntriesCount = recentEntries.length;
  const recentMinutesTotal = recentEntries.reduce(
    (acc, curr) => acc + (Number(curr.minutes) || 0),
    0
  );
  const recentHoursTotal = Math.round((recentMinutesTotal / 60) * 10) / 10;

  // 5. Último apontamento histórico
  let lastEntryDate: string | null = null;
  if (recentEntries.length > 0) {
    lastEntryDate = recentEntries[0].entry_date;
  } else {
    const { data: lastEntry } = await admin
      .from("time_entries")
      .select("entry_date")
      .eq("tenant_id", tenantId)
      .order("entry_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastEntryDate = lastEntry?.entry_date ?? null;
  }

  let status: "engaged" | "low_activity" | "inactive" = "inactive";
  if (lastEntryDate) {
    const lastDate = new Date(lastEntryDate);
    const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) {
      status = "engaged";
    } else if (diffDays <= 30) {
      status = "low_activity";
    } else {
      status = "inactive";
    }
  }

  return {
    clientsCount: clientsCount ?? 0,
    contractsCount: contractsCount ?? 0,
    employeesCount,
    activeEmployeesCount,
    recentEntriesCount,
    recentHoursTotal: Math.round(recentHoursTotal * 10) / 10,
    lastEntryDate,
    status,
  };
}

export async function updatePlatformSettingsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireSuperAdmin();
  const supportWhatsapp = String(formData.get("supportWhatsapp") ?? "").trim();
  const supportEmail = String(formData.get("supportEmail") ?? "").trim();
  const defaultTrialDays = parseInt(String(formData.get("defaultTrialDays") ?? "14"), 10) || 14;
  const allowPublicSignup =
    formData.get("allowPublicSignup") === "true" || formData.get("allowPublicSignup") === "on";

  await savePlatformSettings({
    supportWhatsapp,
    supportEmail,
    defaultTrialDays,
    allowPublicSignup,
  });

  await logAuditEvent({
    action: "Configurações Globais Atualizadas",
    tenantName: "Sistema Geral",
    superAdminEmail: user.email!,
    details: `WhatsApp: ${supportWhatsapp || "padrão"}, E-mail: ${supportEmail}, Trial Padrão: ${defaultTrialDays} dias`,
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
  return { success: "Configurações da plataforma atualizadas com sucesso!" };
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
  cookieStore.set(
    "sa_impersonate_tenant_name",
    encodeURIComponent(tenant.name),
    { path: "/", maxAge: 60 * 60 * 24 }
  );
  cookieStore.set("sa_impersonate_tenant_id", tenant.id, { path: "/", maxAge: 60 * 60 * 24 });

  await logAuditEvent({
    action: "Sessão de Suporte (Impersonate)",
    tenantId: tenant.id,
    tenantName: tenant.name,
    superAdminEmail: user.email!,
    details: `Super Admin acessou o ambiente de trabalho da empresa "${tenant.name}" no modo suporte.`,
  });

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
  const { user } = await requireSuperAdmin();
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
      .neq("title", "[SYS_AUDIT_LOGS]")
      .neq("title", "[SYS_PLATFORM_SETTINGS]")
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

    await logAuditEvent({
      action: isActive ? "Publicação de Comunicado Global" : "Desativação de Comunicado",
      tenantName: "Global",
      superAdminEmail: user.email!,
      details: isActive ? `Título: ${title}` : "Comunicado desativado.",
    });

    revalidatePath("/", "layout");
    revalidatePath("/super-admin");
    return {
      success: isActive
        ? "Comunicado publicado com sucesso para todos os usuários!"
        : "Comunicado desativado com sucesso.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Erro ao salvar comunicado: ${msg}` };
  }
}

export type SuperAdminMember = {
  id: string;
  email: string;
  createdAt: string;
  source: "db" | "env";
};

export async function addSuperAdminAction(
  rawEmail: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const { user } = await requireSuperAdmin();
  const email = rawEmail.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Informe um endereço de e-mail válido." };
  }

  const admin = createAdminClient();
  const { data: existing, error: selErr } = await admin
    .from("super_admins")
    .select("id, email");

  if (selErr) {
    return { ok: false, error: translateError(selErr) };
  }

  const alreadyExists = (existing ?? []).some(
    (row) => String(row.email).trim().toLowerCase() === email,
  );
  if (alreadyExists) {
    return { ok: false, error: "Este e-mail já está cadastrado como Super Admin." };
  }

  const { error: insErr } = await admin.from("super_admins").insert({ email });
  if (insErr) {
    return { ok: false, error: translateError(insErr) };
  }

  await logAuditEvent({
    action: "Adição de Super Admin",
    tenantName: "Acesso Master",
    superAdminEmail: user.email!,
    details: `Novo Super Admin autorizado: ${email}`,
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
  return { ok: true, message: `Super Admin ${email} adicionado com sucesso.` };
}

export async function removeSuperAdminAction(
  id: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: allRows, error: listErr } = await admin
    .from("super_admins")
    .select("id, email");

  if (listErr) {
    return { ok: false, error: translateError(listErr) };
  }

  const rows = allRows ?? [];
  const target = rows.find((r) => r.id === id);
  if (!target) {
    return { ok: false, error: "Registro de Super Admin não encontrado." };
  }

  if (rows.length <= 1) {
    return {
      ok: false,
      error: "Operação bloqueada: é obrigatório manter pelo menos 1 Super Admin no sistema.",
    };
  }

  const { error: delErr } = await admin.from("super_admins").delete().eq("id", id);
  if (delErr) {
    return { ok: false, error: translateError(delErr) };
  }

  await logAuditEvent({
    action: "Remoção de Super Admin",
    tenantName: "Acesso Master",
    superAdminEmail: user.email!,
    details: `Acesso de Super Admin revogado para: ${target.email}`,
  });

  revalidatePath("/super-admin");
  revalidatePath("/", "layout");
  return { ok: true, message: `Acesso de Super Admin removido para ${target.email}.` };
}
