import { requireSuperAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/database.types";
import { getConfiguredSuperAdminEmails, getSubscriptionInfo } from "@/lib/subscription/status";
import { calculateTenantMrr } from "@/lib/subscription/mrr";
import { InfoTooltip } from "@/components/info-tooltip";
import { StatsCards, type TenantStats } from "./stats-cards";
import {
  TenantsTable,
  type TenantRowData,
  type TenantMember,
  type TenantHealthStatus,
} from "./tenants-table";
import { CreateTenantDialog } from "./create-tenant-dialog";
import { BroadcastDialog } from "./broadcast-dialog";
import { PlatformSettingsDialog } from "./platform-settings-dialog";
import { AuditLogsDialog } from "./audit-logs-dialog";
import { SuperAdminsVaultTrigger } from "./super-admins-vault-dialog";
import type { SuperAdminMember } from "./actions";
import { getPlatformSettings } from "./platform-settings";
import { getAuditLogs } from "./audit";

export const metadata = { title: "Administração Geral | Apontamento" };

function rolePriority(role: string): number {
  if (role === "admin") return 0;
  if (role === "gestor" || role === "manager") return 1;
  if (role === "colaborador") return 2;
  return 3;
}

function diffDaysFromToday(isoDate: string): number {
  const todayStr = new Date().toISOString().split("T")[0];
  const todayMs = new Date(`${todayStr}T12:00:00Z`).getTime();
  const targetMs = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).getTime();
  if (!Number.isFinite(targetMs)) return 9999;
  return Math.max(0, Math.round((todayMs - targetMs) / 86400000));
}

export default async function SuperAdminPage() {
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  // 1. Busca todas as empresas ordenadas pelas mais recentes
  const { data: tenantsData, error: tenantsError } = await admin
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantsError) {
    throw new Error(`Falha ao carregar empresas: ${tenantsError.message}`);
  }

  // 2. Busca todos os perfis com detalhes de cargo, permissão de custos e e-mail
  const { data: profilesData } = await admin
    .from("profiles")
    .select("id, tenant_id, full_name, email, role, can_view_costs, active, created_at")
    .order("created_at", { ascending: true });

  const membersByTenant = new Map<string, TenantMember[]>();
  (profilesData ?? []).forEach((p) => {
    const list = membersByTenant.get(p.tenant_id) ?? [];
    list.push({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      role: p.role,
      canViewCosts: p.can_view_costs,
      active: p.active,
      createdAt: p.created_at,
    });
    membersByTenant.set(p.tenant_id, list);
  });

  // Ordena membros: ativos primeiro -> admin -> gestor -> colaborador -> nome A-Z
  for (const [tid, list] of membersByTenant.entries()) {
    list.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const roleDiff = rolePriority(a.role) - rolePriority(b.role);
      if (roleDiff !== 0) return roleDiff;
      return a.fullName.localeCompare(b.fullName, "pt-BR");
    });
    membersByTenant.set(tid, list);
  }

  // 3. Apontamentos recentes (últimos 30 dias) paginados para engajamento por tenant e total global
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const entriesByTenant = new Map<
    string,
    { count: number; minutes: number; lastEntryDate: string | null }
  >();
  let recentEntries = 0;

  try {
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data: page, error: entriesErr } = await admin
        .from("time_entries")
        .select("id, tenant_id, minutes, entry_date")
        .gte("entry_date", thirtyDaysAgo)
        .order("entry_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (entriesErr || !page || page.length === 0) break;

      recentEntries += page.length;
      for (const row of page) {
        const current = entriesByTenant.get(row.tenant_id) ?? {
          count: 0,
          minutes: 0,
          lastEntryDate: null,
        };
        current.count += 1;
        current.minutes += Number(row.minutes) || 0;
        if (!current.lastEntryDate || row.entry_date > current.lastEntryDate) {
          current.lastEntryDate = row.entry_date;
        }
        entriesByTenant.set(row.tenant_id, current);
      }

      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  } catch {
    recentEntries = 0;
  }

  // Para tenants sem lançamento nos últimos 30 dias, busca a última data histórica
  const tenantsWithoutRecent = (tenantsData ?? []).filter((t) => !entriesByTenant.has(t.id));
  const historicalLastDates = new Map<string, string | null>();
  if (tenantsWithoutRecent.length > 0) {
    const results = await Promise.all(
      tenantsWithoutRecent.map(async (t) => {
        try {
          const { data: lastEntry } = await admin
            .from("time_entries")
            .select("entry_date")
            .eq("tenant_id", t.id)
            .order("entry_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          return [t.id, lastEntry?.entry_date ?? null] as const;
        } catch {
          return [t.id, null] as const;
        }
      })
    );
    for (const [tid, lastDate] of results) {
      historicalLastDates.set(tid, lastDate);
    }
  }

  const tenants: TenantRowData[] = (tenantsData ?? []).map((t) => {
    const users = membersByTenant.get(t.id) ?? [];
    // Identifica o administrador principal (prioriza admin ativo)
    const primaryAdmin =
      users.find((u) => u.role === "admin" && u.active) ||
      users.find((u) => u.role === "admin") ||
      users[0] ||
      null;

    const recentAgg = entriesByTenant.get(t.id);
    const lastEntryDate = recentAgg?.lastEntryDate ?? historicalLastDates.get(t.id) ?? null;

    let healthStatus: TenantHealthStatus = "inactive";
    if (lastEntryDate) {
      const diffDays = diffDaysFromToday(lastEntryDate);
      if (diffDays <= 7) {
        healthStatus = "engaged";
      } else if (diffDays <= 30) {
        healthStatus = "low_activity";
      } else {
        healthStatus = "inactive";
      }
    }

    return {
      ...(t as Tables<"tenants">),
      membersCount: users.length,
      users,
      primaryAdmin,
      recentEntries30d: recentAgg?.count ?? 0,
      recentHours30d: recentAgg ? Math.round((recentAgg.minutes / 60) * 10) / 10 : 0,
      lastEntryDate,
      healthStatus,
    };
  });

  // 4. Calcula indicadores gerais e financeiros com MRR real/customizado
  let mrr = 0;
  let payingCount = 0;
  let expiringSoon = 0;
  let churnRiskCount = 0;

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

    const isOperationalStatus =
      t.subscription_status === "manual_active" ||
      t.subscription_status === "active" ||
      t.subscription_status === "trialing";

    if (isOperationalStatus && t.healthStatus !== "engaged") {
      churnRiskCount++;
    }

    // Soma MRR (suporta valores padrão do plano e [MRR: X] customizado)
    const tenantMrr = calculateTenantMrr(t);
    if (tenantMrr > 0) {
      mrr += tenantMrr;
      payingCount++;
    }
  });

  const arr = mrr * 12;
  const arpu = payingCount > 0 ? Math.round(mrr / payingCount) : 0;

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

  // 6. Carrega configurações, logs de auditoria e lista de Super Admins
  const [platformSettings, auditLogs, { data: superAdminsRows }] = await Promise.all([
    getPlatformSettings(),
    getAuditLogs(),
    admin.from("super_admins").select("id, email, created_at").order("created_at", { ascending: true }),
  ]);

  const superAdmins: SuperAdminMember[] = (superAdminsRows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    source: "db",
  }));

  const dbEmailsSet = new Set(superAdmins.map((a) => a.email.trim().toLowerCase()));
  for (const envEmail of getConfiguredSuperAdminEmails()) {
    if (!dbEmailsSet.has(envEmail)) {
      superAdmins.push({
        id: `env-${envEmail}`,
        email: envEmail,
        createdAt: new Date(0).toISOString(),
        source: "env",
      });
    }
  }

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
    arpu,
    expiringSoon,
    recentEntries,
    churnRiskCount,
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <SuperAdminsVaultTrigger
            superAdmins={superAdmins}
            currentUserEmail={user.email ?? ""}
          />
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Administração SaaS</h1>
            <InfoTooltip text="Painel executivo: métricas de receita (MRR/ARR), gestão de empresas, saúde de uso, risco de churn e suporte." />
          </div>
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
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Empresas Cadastradas</h2>
          <InfoTooltip text="Clique no nome da empresa para abrir a visão 360° de saúde ou na coluna Usuários para visualizar admins, gestores e colaboradores." />
        </div>
        <TenantsTable tenants={tenants} />
      </div>
    </div>
  );
}
