import { ShieldCheckIcon } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/database.types";
import { getSubscriptionInfo } from "@/lib/subscription/status";
import { StatsCards, type TenantStats } from "./stats-cards";
import { TenantsTable, type TenantRowData } from "./tenants-table";
import { CreateTenantDialog } from "./create-tenant-dialog";
import { BroadcastDialog } from "./broadcast-dialog";

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

  // 2. Busca contagem de membros por empresa
  const { data: profilesData } = await admin.from("profiles").select("tenant_id");

  const membersCountByTenant = new Map<string, number>();
  (profilesData ?? []).forEach((p) => {
    const current = membersCountByTenant.get(p.tenant_id) ?? 0;
    membersCountByTenant.set(p.tenant_id, current + 1);
  });

  const tenants: TenantRowData[] = (tenantsData ?? []).map((t) => ({
    ...(t as Tables<"tenants">),
    membersCount: membersCountByTenant.get(t.id) ?? 0,
  }));

  // 3. Calcula indicadores gerais e financeiros
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

    // MRR para empresas ativas
    if (t.subscription_status === "manual_active" || t.subscription_status === "active") {
      if (t.plan_tier === "enterprise") {
        mrr += 397;
      } else if (t.plan_tier === "pro") {
        mrr += 197;
      } else {
        mrr += 97;
      }
    }
  });

  const arr = mrr * 12;

  // 4. Apontamentos recentes (últimos 30 dias) para medir o engajamento
  let recentEntries = 0;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { count } = await admin
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .gte("date", thirtyDaysAgo);
    recentEntries = count ?? 0;
  } catch {
    recentEntries = 0;
  }

  // 5. Busca comunicado existente
  let announcement = null;
  try {
    const { data: ann } = await (admin as any)
      .from("system_announcements")
      .select("id, title, message, type, is_active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ann) {
      announcement = ann;
    }
  } catch {
    announcement = null;
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
            Painel executivo: métricas de receita (MRR/ARR), gestão de empresas, suporte e comunicados.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
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
