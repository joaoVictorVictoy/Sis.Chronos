import { ShieldCheckIcon } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/database.types";
import { getSubscriptionInfo } from "@/lib/subscription/status";
import { calculateTenantMrr } from "@/lib/subscription/mrr";
import { StatsCards, type TenantStats } from "./stats-cards";
import { TenantsTable, type TenantRowData, type TenantMember } from "./tenants-table";
import { CreateTenantDialog } from "./create-tenant-dialog";
import { BroadcastDialog } from "./broadcast-dialog";
import { PlatformSettingsDialog } from "./platform-settings-dialog";
import { AuditLogsDialog } from "./audit-logs-dialog";
import { getPlatformSettings } from "./platform-settings";
import { getAuditLogs } from "./audit";

export const metadata = { title: "Administração Geral | Apontamento" };

export default async function SuperAdminPage() {
  await requireSuperAdmin();
  const admin = createAdminClient();

  // 1. Busca todas as empresas ordenadas pelas mais recentes
  const { data: tenantsData, error: tenantsError } = await admin
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantsError) {
    throw new Error(`Falha ao carregar empresas: ${tenantsError.message}`);
  }

  // 2. Busca todos os perfis com detalhes de cargo e e-mail
  const { data: profilesData } = await admin
    .from("profiles")
    .select("id, tenant_id, full_name, email, role, active, created_at")
    .order("created_at", { ascending: true });

  const membersByTenant = new Map<string, TenantMember[]>();
  (profilesData ?? []).forEach((p) => {
    const list = membersByTenant.get(p.tenant_id) ?? [];
    list.push({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      role: p.role,
      active: p.active,
      createdAt: p.created_at,
    });
    membersByTenant.set(p.tenant_id, list);
  });

  const tenants: TenantRowData[] = (tenantsData ?? []).map((t) => {
    const users = membersByTenant.get(t.id) ?? [];
    // Identifica o administrador principal (prioriza admin ativo)
    const primaryAdmin =
      users.find((u) => u.role === "admin" && u.active) ||
      users.find((u) => u.role === "admin") ||
      users[0] ||
      null;

    return {
      ...(t as Tables<"tenants">),
      membersCount: users.length,
      users,
      primaryAdmin,
    };
  });

  // 3. Calcula indicadores gerais e financeiros com MRR real/customizado
  let mrr = 0;
  let expiringSoon = 0;

  tenants.forEach((t) => {
    const sub = getSubscriptionInfo(t);
    // Vencendo nos próximos 7 dias
    if (
      sub.daysRemaining !== null &&
      sub.daysRemaining >= 0 &&
      sub.daysRemaining <= 7 &&
      t.subscription_status !== "suspended" &&
      t.subscription_status !== "canceled"
    ) {
      expiringSoon++;
    }

    // Soma MRR (suporta valores padrão do plano e [MRR: X] customizado)
    mrr += calculateTenantMrr(t);
  });

  const arr = mrr * 12;

  // 4. Apontamentos recentes (últimos 30 dias) para medir o engajamento
  let recentEntries = 0;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { count } = await admin
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .gte("entry_date", thirtyDaysAgo);
    recentEntries = count ?? 0;
  } catch {
    recentEntries = 0;
  }

  // 5. Busca comunicado do sistema (ignora registros de configurações internas)
  let announcement = null;
  try {
    const { data: ann } = await (admin as any)
      .from("system_announcements")
      .select("id, title, message, type, is_active")
      .neq("title", "[SYS_AUDIT_LOGS]")
      .neq("title", "[SYS_PLATFORM_SETTINGS]")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ann) {
      announcement = ann;
    }
  } catch {
    announcement = null;
  }

  // 6. Carrega configurações e logs de auditoria
  const [platformSettings, auditLogs] = await Promise.all([
    getPlatformSettings(),
    getAuditLogs(),
  ]);

  const stats: TenantStats = {
    total: tenants.length,
    active: tenants.filter(
      (t) => t.subscription_status === "manual_active" || t.subscription_status === "active"
    ).length,
    trialing: tenants.filter((t) => t.subscription_status === "trialing").length,
    suspended: tenants.filter(
      (t) =>
        t.subscription_status === "suspended" ||
        t.subscription_status === "past_due" ||
        t.subscription_status === "canceled"
    ).length,
    mrr,
    arr,
    expiringSoon,
    recentEntries,
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheckIcon className="size-4" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Administração SaaS</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Painel executivo: métricas de receita (MRR/ARR), gestão de empresas, saúde do cliente e suporte.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <AuditLogsDialog logs={auditLogs} />
          <PlatformSettingsDialog initialSettings={platformSettings} />
          <BroadcastDialog initialAnnouncement={announcement} />
          <CreateTenantDialog />
        </div>
      </header>

      <StatsCards stats={stats} />

      <div className="space-y-3 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">Empresas Cadastradas</h2>
        <TenantsTable tenants={tenants} />
      </div>
    </div>
  );
}
