import Link from "next/link";
import { BellRingIcon, CalendarX2Icon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayISO } from "@/lib/format";
import { startOfWeek, weekDays } from "@/lib/time";
import { getEmployeeMissingDays } from "@/lib/pending-actions";
import type { Tables } from "@/lib/database.types";
import type { LeaveRecord } from "../minhas-analises/leaves-dialog";
import { EntryModes } from "./entry-modes";
import { WeekEntries } from "./week-entries";

export const metadata = { title: "Apontamentos | Apontamento" };

export type ClientOption = {
  id: string;
  name: string;
  legalName?: string;
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
  const { tenant, profile, employeeId, employeeMonthlyHours } = await requireContext();
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
      ? supabase.from("employees").select("id, full_name, active, monthly_hours").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const employees: EmployeeOption[] = (employeesData ?? []).map((e) => ({
    id: e.id,
    name: e.full_name,
    active: e.active,
  }));

  // Resolução do colaborador selecionado para visualização:
  // - Gestor e Admin: por padrão vê as horas de TODOS os colaboradores ("todos"), ou filtra pelo colaborador da URL.
  // - Colaborador: estritamente restrito a ver APENAS as suas próprias horas.
  let selectedEmployeeId: string = "todos";
  if (isManagerUser) {
    if (typeof colaborador === "string" && colaborador) {
      selectedEmployeeId = colaborador;
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

  // Busca de férias e afastamentos na semana
  let leavesQuery = supabase
    .from("employee_leaves")
    .select("id, employee_id, start_date, end_date, type, notes")
    .lte("start_date", days[6])
    .gte("end_date", days[0]);

  if (selectedEmployeeId !== "todos") {
    entriesQuery = entriesQuery.eq("employee_id", selectedEmployeeId);
    leavesQuery = leavesQuery.eq("employee_id", selectedEmployeeId);
  }

  const [{ data: entries }, { data: leavesData }] = await Promise.all([
    entriesQuery,
    leavesQuery,
  ]);

  const clientMap = new Map((clientsData ?? []).map((c) => [c.id, c.trade_name || c.legal_name]));

  const clientOptions: ClientOption[] = (clientsData ?? [])
    .map((c) => ({
      id: c.id,
      name: c.trade_name || c.legal_name,
      legalName: c.legal_name || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));

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

  let targetMonthlyHours: number = employeeMonthlyHours ?? Number(tenant.monthly_hours);
  if (isManagerUser) {
    if (selectedEmployeeId !== "todos") {
      const selectedEmp = (employeesData as { id: string; monthly_hours?: number | null }[] | null)?.find(
        (e) => e.id === selectedEmployeeId,
      );
      targetMonthlyHours = Number(selectedEmp?.monthly_hours ?? tenant.monthly_hours);
    } else {
      targetMonthlyHours = Number(tenant.monthly_hours);
    }
  }

  const missingDays = employeeId ? await getEmployeeMissingDays(supabase, employeeId) : [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Apontamentos"
        description="Lance suas horas selecionando Cliente, Área e Atividade. O contrato vigente é vinculado automaticamente."
      />

      {missingDays.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 shrink-0">
              <BellRingIcon className="size-3.5" />
              {missingDays.length} {missingDays.length === 1 ? "dia útil sem apontamento no mês" : "dias úteis sem apontamento no mês"}:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {missingDays.map((day) => (
                <Link
                  key={day}
                  href={`/apontamentos?semana=${day}`}
                  className="inline-flex items-center gap-1 rounded border border-border/70 bg-card hover:bg-muted px-2 py-0.5 font-medium transition-colors shadow-2xs"
                  title="Clique para ir para a semana desta data"
                >
                  <CalendarX2Icon className="size-3 text-muted-foreground" />
                  {formatDate(day)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {employeeId ? (
        <EntryModes
          clients={clientOptions}
          areas={areaOptions}
          activities={activityOptions}
          contracts={contractOptions}
          clientAreas={clientAreaOptions}
          today={today}
          lockedThrough={lockedThrough}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sem cadastro de colaborador vinculado</CardTitle>
            <CardDescription>
              Seu login não está vinculado a um colaborador, portanto você não pode lançar horas. A visualização das horas da equipe está disponível abaixo.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <WeekEntries
        weekStart={weekStart}
        days={days}
        entries={(entries ?? []) as TimeEntryWithEmployee[]}
        clients={clientOptions}
        areas={areaOptions}
        activities={activityOptions}
        contracts={contractOptions}
        clientAreas={clientAreaOptions}
        monthlyHours={targetMonthlyHours}
        lockedThrough={lockedThrough}
        today={today}
        role={profile.role}
        employees={employees}
        selectedEmployeeId={selectedEmployeeId}
        currentEmployeeId={employeeId ?? null}
        leaves={(leavesData ?? []) as LeaveRecord[]}
      />
    </div>
  );
}
