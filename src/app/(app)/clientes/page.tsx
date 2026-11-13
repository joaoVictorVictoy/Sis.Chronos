import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { ClientsTable, NewClientForm } from "./clients-client";

export const metadata = { title: "Clientes | Apontamento" };

export default async function ClientsPage() {
  const { profile } = await requireRole(["admin", "gestor"]);
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*, contracts(count)").order("legal_name");
  const clients = ((data ?? []) as (Tables<"clients"> & { contracts: { count: number }[] })[]).sort((a, b) =>
    (a.trade_name || a.legal_name).localeCompare(b.trade_name || b.legal_name, "pt-BR", { numeric: true }),
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Clientes"
        description={
          isAdmin
            ? "Cada cliente pode ter um ou mais contratos — é onde a rentabilidade é medida."
            : "Cadastro e acompanhamento de clientes e suas atividades."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo cliente</CardTitle>
          <CardDescription>
            {isAdmin ? "Os contratos são cadastrados dentro do cliente." : "Cadastre uma nova empresa cliente."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewClientForm />
        </CardContent>
      </Card>

      <Card>
        <ClientsTable clients={clients} isAdmin={isAdmin} />
      </Card>
    </div>
  );
}
