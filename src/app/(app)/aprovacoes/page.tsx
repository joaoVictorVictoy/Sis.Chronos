import { EmptyState, PageHeader } from "@/components/page-header";
import { ExportMenu } from "@/components/export-menu";
import { InfoTooltip } from "@/components/info-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatHours } from "@/lib/format";
import type { Tables } from "@/lib/database.types";
import { ApprovalList } from "./approval-list";

import { DeletionApprovalList } from "./deletion-approval-list";

export const metadata = { title: "Aprovações | Apontamento" };

export type PendingEntry = Tables<"time_entries"> & {
  employees: Pick<Tables<"employees">, "id" | "full_name"> | null;
  activities: Pick<Tables<"activities">, "id" | "name"> | null;
  contracts: (Pick<Tables<"contracts">, "id" | "name"> & {
    clients: Pick<Tables<"clients">, "legal_name" | "trade_name"> | null;
  }) | null;
};

export default async function ApprovalsPage() {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();

  const [{ data: pendingData }, { data: deletionData }] = await Promise.all([
    supabase
      .from("time_entries")
      .select(
        "*, employees(id, full_name), activities(id, name), contracts(id, name, clients(legal_name, trade_name))",
      )
      .eq("status", "pendente")
      .order("entry_date", { ascending: false })
      .limit(300),
    supabase
      .from("time_entries")
      .select(
        "*, employees(id, full_name), activities(id, name), contracts(id, name, clients(legal_name, trade_name))",
      )
      .not("deletion_requested_at", "is", null)
      .order("deletion_requested_at", { ascending: false })
      .limit(300),
  ]);

  const entries = (pendingData ?? []) as unknown as PendingEntry[];
  const deletionRequests = (deletionData ?? []) as unknown as PendingEntry[];

  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const totalDeletionMinutes = deletionRequests.reduce((sum, e) => sum + e.minutes, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Aprovações e Solicitações"
        description="Gestão de apontamentos de horas. Revise novos lançamentos, correções solicitadas e pedidos de exclusão."
        descriptionAsTooltip
      >
        <ExportMenu dataset="apontamentos" label="Exportar apontamentos" scope="todos" />
      </PageHeader>

      {/* Seção 1: Solicitações de Exclusão */}
      <Card className={deletionRequests.length > 0 ? "border-amber-500/50 shadow-sm" : ""}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <span>Solicitações de Exclusão</span>
              {deletionRequests.length > 0 ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {deletionRequests.length} pendente(s) · {formatHours(totalDeletionMinutes / 60)}
                </span>
              ) : null}
              <InfoTooltip
                side="right"
                text="Apontamentos já aprovados cuja exclusão foi solicitada por colaboradores com justificativa."
              />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {deletionRequests.length === 0 ? (
            <EmptyState>Nenhuma solicitação de exclusão pendente. Tudo em conformidade.</EmptyState>
          ) : (
            <DeletionApprovalList requests={deletionRequests} />
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Apontamentos Pendentes (novos ou corrigidos) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>
              Apontamentos Pendentes · {entries.length} registro(s) ({formatHours(totalMinutes / 60)})
            </span>
            <InfoTooltip
              side="right"
              text="Apontamentos aguardando aprovação ou corrigidos por colaboradores. Selecione os itens para aprovar ou rejeitar."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState>Nenhum apontamento pendente de revisão. Tudo revisado por aqui.</EmptyState>
          ) : (
            <ApprovalList entries={entries} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
