"use client";

import { useActionState, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/page-header";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import type { Tables } from "@/lib/database.types";
import { createActivityAction, deleteActivityAction, updateActivityAction } from "./actions";

export type AreaOption = Pick<Tables<"areas">, "id" | "name" | "active">;
export type ClientOption = {
  id: string;
  name: string;
  active: boolean;
};
export type ClientAreaOption = {
  clientId: string;
  areaId: string;
};

type ActivityWithUsage = Tables<"activities"> & { time_entries: { count: number }[] };

function AreaOptions({ areas, selected }: { areas: AreaOption[]; selected?: string }) {
  return (
    <>
      {areas
        .filter((area) => area.active || area.id === selected)
        .map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
            {area.active ? "" : " (inativa)"}
          </option>
        ))}
    </>
  );
}

function ClientOptions({ clients, selected }: { clients: ClientOption[]; selected?: string | null }) {
  return (
    <>
      <option value="">Geral (sem cliente)</option>
      {clients
        .filter((c) => c.active || c.id === selected)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.active ? "" : " (inativo)"}
          </option>
        ))}
    </>
  );
}

export function ActivityForm({
  areas,
  clients,
  clientAreas,
}: {
  areas: AreaOption[];
  clients: ClientOption[];
  clientAreas: ClientAreaOption[];
}) {
  const [state, formAction] = useActionState(createActivityAction, initialActionState);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Áreas disponíveis para o cliente selecionado
  const availableAreas = useMemo(() => {
    if (!selectedClientId) return areas;
    const directAreaIds = clientAreas.filter((ca) => ca.clientId === selectedClientId).map((ca) => ca.areaId);
    if (directAreaIds.length > 0) {
      const filtered = areas.filter((a) => directAreaIds.includes(a.id));
      if (filtered.length > 0) return filtered;
    }
    return areas;
  }, [selectedClientId, clientAreas, areas]);

  const defaultArea = availableAreas.find((a) => a.active)?.id ?? availableAreas[0]?.id;

  return (
    <form action={formAction} className="grid gap-4">
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-[1.5fr_1.5fr_2fr_auto_auto] sm:items-end">
        <Field label="Cliente" htmlFor="clientId" errors={state.fieldErrors?.clientId}>
          <NativeSelect
            id="clientId"
            name="clientId"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <ClientOptions clients={clients} />
          </NativeSelect>
        </Field>

        <Field label="Área de consultoria" htmlFor="areaId" errors={state.fieldErrors?.areaId}>
          <NativeSelect id="areaId" name="areaId" defaultValue={defaultArea} required key={selectedClientId}>
            <AreaOptions areas={availableAreas} />
          </NativeSelect>
        </Field>

        <Field label="Nome da atividade" htmlFor="name" errors={state.fieldErrors?.name}>
          <Input id="name" name="name" required placeholder="Ex.: BPO Financeiro" />
        </Field>

        <label className="flex items-center gap-2 pb-2 text-sm whitespace-nowrap">
          <NativeCheckbox name="billable" defaultChecked />
          Faturável
        </label>
        <SubmitButton>Adicionar</SubmitButton>
      </div>
    </form>
  );
}

function ActivityRow({
  activity,
  areas,
  clients,
}: {
  activity: ActivityWithUsage;
  areas: AreaOption[];
  clients: ClientOption[];
}) {
  const [state, formAction] = useActionState(updateActivityAction, initialActionState);

  return (
    <TableRow>
      <TableCell colSpan={7} className="p-0">
        <form
          action={formAction}
          className="grid items-center gap-3 px-3 py-2 sm:grid-cols-[2fr_1.5fr_1.5fr_auto_auto_auto_auto]"
        >
          <input type="hidden" name="id" value={activity.id} />
          <Input name="name" defaultValue={activity.name} aria-label="Nome da atividade" required />

          <NativeSelect name="clientId" defaultValue={activity.client_id ?? ""} aria-label="Cliente">
            <ClientOptions clients={clients} selected={activity.client_id} />
          </NativeSelect>

          <NativeSelect name="areaId" defaultValue={activity.area_id} aria-label="Área" required>
            <AreaOptions areas={areas} selected={activity.area_id} />
          </NativeSelect>

          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <NativeCheckbox name="billable" defaultChecked={activity.billable} />
            Faturável
          </label>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <NativeCheckbox name="active" defaultChecked={activity.active} />
            Ativa
          </label>
          <SubmitButton size="sm" variant="outline">
            Salvar
          </SubmitButton>
          <DeleteButton
            action={deleteActivityAction}
            hiddenFields={{ id: activity.id }}
            title="Excluir atividade"
            description={`Tem certeza que deseja excluir a atividade "${activity.name}"? Se houver histórico de apontamentos, ela será desativada para preservar os relatórios.`}
          />
          {state.error || state.success ? (
            <div className="sm:col-span-7">
              <FormAlert state={state} />
            </div>
          ) : null}
        </form>
      </TableCell>
    </TableRow>
  );
}

export function ActivitiesTable({
  activities,
  areas,
  clients,
}: {
  activities: ActivityWithUsage[];
  areas: AreaOption[];
  clients: ClientOption[];
}) {
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (clientFilter === "general" && act.client_id !== null) return false;
      if (clientFilter !== "all" && clientFilter !== "general" && act.client_id !== clientFilter) return false;
      if (areaFilter !== "all" && act.area_id !== areaFilter) return false;
      return true;
    });
  }, [activities, clientFilter, areaFilter]);

  if (!activities.length) return <EmptyState>Nenhuma atividade cadastrada ainda.</EmptyState>;

  return (
    <div className="space-y-4">
      {/* Filtros rápidos */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filtrar por Cliente:</span>
          <NativeSelect value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="w-auto h-8 text-xs">
            <option value="all">Todos os clientes</option>
            <option value="general">Gerais (sem cliente)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filtrar por Área:</span>
          <NativeSelect value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="w-auto h-8 text-xs">
            <option value="all">Todas as áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {filteredActivities.length} de {activities.length} atividade(s)
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead colSpan={7}>Atividades</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredActivities.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-6 text-sm text-muted-foreground">
                Nenhuma atividade encontrada com os filtros selecionados.
              </TableCell>
            </TableRow>
          ) : (
            filteredActivities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} areas={areas} clients={clients} />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
