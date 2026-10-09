import { ShieldCheckIcon } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/database.types";
import { StatsCards, type TenantStats } from "./stats-cards";
import { TenantsTable, type TenantRowData } from "./tenants-table";
import { CreateTenantDialog } from "./create-tenant-dialog";

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

  // 3. Calcula indicadores gerais
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
            Gerencie todas as empresas clientes, status de assinaturas, liberações manuais e contratos Pix.
          </p>
        </div>

        <CreateTenantDialog />
      </header>

      <StatsCards stats={stats} />

      <div className="space-y-3 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">Empresas Cadastradas</h2>
        <TenantsTable tenants={tenants} />
      </div>
    </div>
  );
}
