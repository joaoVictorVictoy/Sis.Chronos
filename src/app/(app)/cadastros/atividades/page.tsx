import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { ActivitiesTable, ActivityForm } from "./activities-client";

export const metadata = { title: "Atividades | Apontamento" };

export default async function ActivitiesPage() {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();

  const [{ data: activities }, { data: areas }, { data: clients }, { data: clientAreas }] = await Promise.all([
    supabase.from("activities").select("*, time_entries(count)").order("name"),
    supabase.from("areas").select("id, name, active").order("name"),
    supabase.from("clients").select("id, legal_name, trade_name, active").order("legal_name"),
    supabase.from("client_areas").select("client_id, area_id"),
  ]);

  const areaOptions = (areas ?? []) as Pick<Tables<"areas">, "id" | "name" | "active">[];
  const clientOptions = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.trade_name || c.legal_name,
    active: c.active,
  }));
  const clientAreaOptions = (clientAreas ?? []).map((ca) => ({
    clientId: ca.client_id,
    areaId: ca.area_id,
  }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Atividades"
        description="Atividades vinculadas aos Clientes e às Áreas de consultoria. A marcação faturável alimenta os relatórios de produtividade."
      />

      {areaOptions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Cadastre uma área primeiro</CardTitle>
            <CardDescription>
              Atividades pertencem a uma área de atuação.{" "}
              <Link href="/cadastros/areas" className="font-medium text-foreground underline">
                Cadastrar áreas
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nova atividade</CardTitle>
            <CardDescription>Ex.: BPO Financeiro, Planejamento Estratégico, Levantamento de informações.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityForm areas={areaOptions} clients={clientOptions} clientAreas={clientAreaOptions} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Atividades cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivitiesTable
            activities={(activities ?? []) as (Tables<"activities"> & { time_entries: { count: number }[] })[]}
            areas={areaOptions}
            clients={clientOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
