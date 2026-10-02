import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { startOfWeek, weekDays } from "@/lib/time";
import type { Tables } from "@/lib/database.types";
import { EntryModes } from "./entry-modes";
import { WeekEntries } from "./week-entries";

export const metadata = { title: "Apontamentos | Apontamento" };

export type ClientOption = {
  id: string;
  name: string;
};

export type AreaOption = {
  id: string;
  name: string;
};

export type ActivityOption = {
  id: string;
  name: string;
  billable: boolean;
  area_id: string;
  client_id?: string | null;
};

export type ContractOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
};

export type ClientAreaOption = {
  clientId: string;
  areaId: string;
};

export default async function TimeEntriesPage({ searchParams }: PageProps<"/apontamentos">) {
  const { semana } = await searchParams;
  const { tenant, employeeId } = await requireContext();
  const today = todayISO();
  const weekStart = startOfWeek(typeof semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : today);
  const days = weekDays(weekStart);
  const supabase = await createClient();

  const [
    { data: contractsData },
    { data: clientsData },
    { data: areasData },
    { data: activitiesData },
    { data: clientAreasData },
    { data: lock },
    { data: entries },
  ] = await Promise.all([
    supabase.from("contract_options").select("id, name, client_id, status").eq("status", "ativo").order("name"),
    supabase.from("clients").select("id, legal_name, trade_name").eq("active", true).order("legal_name"),
    supabase.from("areas").select("id, name, active").eq("active", true).order("name"),
    supabase.from("activities").select("id, name, billable, area_id, client_id").eq("active", true).order("name"),
    supabase.from("client_areas").select("client_id, area_id"),
    supabase.from("period_locks").select("locked_through").maybeSingle(),
    employeeId
      ? supabase
          .from("time_entries")
          .select("*")
          .eq("employee_id", employeeId)
          .gte("entry_date", days[0])
          .lte("entry_date", days[6])
          .order("entry_date")
      : Promise.resolve({ data: [] }),
  ]);

  const clientMap = new Map((clientsData ?? []).map((c) => [c.id, c.trade_name || c.legal_name]));

  const clientOptions: ClientOption[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.trade_name || c.legal_name,
  }));

  const areaOptions: AreaOption[] = (areasData ?? []).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const activityOptions: ActivityOption[] = (activitiesData ?? []).map((act) => ({
    id: act.id,
    name: act.name,
    billable: act.billable,
    area_id: act.area_id,
    client_id: act.client_id,
  }));

  const contractOptions: ContractOption[] = (contractsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    clientId: c.client_id,
    clientName: clientMap.get(c.client_id) ?? "Cliente",
  }));

  const clientAreaOptions: ClientAreaOption[] = (clientAreasData ?? []).map((ca) => ({
    clientId: ca.client_id,
    areaId: ca.area_id,
  }));

  const lockedThrough = lock?.locked_through ?? null;

  if (!employeeId) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Apontamentos" />
        <Card>
          <CardHeader>
            <CardTitle>Sem cadastro de colaborador</CardTitle>
            <CardDescription>
              Seu login ainda não está vinculado a um colaborador, então não é possível apontar horas. Peça ao
              administrador para vincular seu cadastro em Colaboradores.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Apontamentos"
        description="Lance suas horas selecionando Cliente, Área e Atividade. O contrato vigente é vinculado automaticamente."
      />

      <EntryModes
        clients={clientOptions}
        areas={areaOptions}
        activities={activityOptions}
        contracts={contractOptions}
        clientAreas={clientAreaOptions}
        today={today}
        lockedThrough={lockedThrough}
      />

      <WeekEntries
        weekStart={weekStart}
        days={days}
        entries={(entries ?? []) as Tables<"time_entries">[]}
        clients={clientOptions}
        areas={areaOptions}
        activities={activityOptions}
        contracts={contractOptions}
        clientAreas={clientAreaOptions}
        monthlyHours={Number(tenant.monthly_hours)}
        lockedThrough={lockedThrough}
        today={today}
      />
    </div>
  );
}
