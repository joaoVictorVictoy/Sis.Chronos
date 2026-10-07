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

export type EmployeeOption = {
  id: string;
  name: string;
  active: boolean;
};

export type TimeEntryWithEmployee = Tables<"time_entries"> & {
  employees?: { id: string; full_name: string } | null;
};

export default async function TimeEntriesPage({ searchParams }: PageProps<"/apontamentos">) {
  const { semana, colaborador } = await searchParams;
  const { tenant, profile, employeeId } = await requireContext();
  const isManagerUser = profile.role === "admin" || profile.role === "gestor";
  const today = todayISO();
  const weekStart = startOfWeek(typeof semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : today);
  const days = weekDays(weekStart);
  const supabase = await createClient();

  if (!employeeId && !isManagerUser) {
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

  const [
    { data: contractsData },
    { data: clientsData },
    { data: areasData },
    { data: activitiesData },
    { data: clientAreasData },
    { data: lock },
    { data: employeesData },
  ] = await Promise.all([
    supabase.from("contract_options").select("id, name, client_id, status").eq("status", "ativo").order("name"),
    supabase.from("clients").select("id, legal_name, trade_name").eq("active", true).order("legal_name"),
    supabase.from("areas").select("id, name, active").eq("active", true).order("name"),
    supabase.from("activities").select("id, name, billable, area_id, client_id").eq("active", true).order("name"),
    supabase.from("client_areas").select("client_id, area_id"),
    supabase.from("period_locks").select("locked_through").maybeSingle(),
    isManagerUser
      ? supabase.from("employees").select("id, full_name, active").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const employees: EmployeeOption[] = (employeesData ?? []).map((e) => ({
    id: e.id,
    name: e.full_name,
    active: e.active,
  }));

  // Resolução do colaborador selecionado para filtro da semana
  let selectedEmployeeId: string = "todos";
  if (isManagerUser) {
    if (typeof colaborador === "string" && colaborador) {
      selectedEmployeeId = colaborador;
    } else if (employeeId) {
      selectedEmployeeId = employeeId;
    } else {
      selectedEmployeeId = "todos";
    }
  } else {
    selectedEmployeeId = employeeId!;
  }

  // Busca de apontamentos
  let entriesQuery = supabase
    .from("time_entries")
    .select("*, employees(id, full_name)")
    .gte("entry_date", days[0])
    .lte("entry_date", days[6])
    .order("entry_date");

  if (selectedEmployeeId !== "todos") {
    entriesQuery = entriesQuery.eq("employee_id", selectedEmployeeId);
  }

  const { data: entries } = await entriesQuery;

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
        employees={employees}
        selectedEmployeeId={selectedEmployeeId}
        currentEmployeeId={employeeId ?? null}
        isManagerUser={isManagerUser}
      />

      <WeekEntries
        weekStart={weekStart}
        days={days}
        entries={(entries ?? []) as TimeEntryWithEmployee[]}
        clients={clientOptions}
        areas={areaOptions}
        activities={activityOptions}
        contracts={contractOptions}
        clientAreas={clientAreaOptions}
        monthlyHours={Number(tenant.monthly_hours)}
        lockedThrough={lockedThrough}
        today={today}
        role={profile.role}
        employees={employees}
        selectedEmployeeId={selectedEmployeeId}
        currentEmployeeId={employeeId ?? null}
      />
    </div>
  );
}
