"use client";

import { useActionState, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import type { ActivityOption, AreaOption, ClientAreaOption, ClientOption, ContractOption } from "./page";
import { createTimeEntryAction } from "./actions";

export function CascadeSelectors({
  clients,
  areas,
  activities,
  contracts,
  clientAreas,
  defaultClientId,
  defaultAreaId,
  defaultActivityId,
  defaultContractId,
  disabled,
}: {
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  defaultClientId?: string | null;
  defaultAreaId?: string | null;
  defaultActivityId?: string | null;
  defaultContractId?: string | null;
  disabled?: boolean;
}) {
  // Inicialização inteligente: se o contrato foi passado, busca o cliente desse contrato
  const initialClientId =
    defaultClientId ??
    (defaultContractId ? contracts.find((c) => c.id === defaultContractId)?.clientId ?? "" : "");
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);

  // Se a atividade foi passada, busca a área dela
  const initialAreaId =
    defaultAreaId ??
    (defaultActivityId ? activities.find((a) => a.id === defaultActivityId)?.area_id ?? "" : "");
  const [selectedAreaId, setSelectedAreaId] = useState<string>(initialAreaId);

  const [selectedActivityId, setSelectedActivityId] = useState<string>(defaultActivityId ?? "");

  // Contrato ativo vigente do cliente selecionado (vinculado automaticamente)
  const activeContract = useMemo(() => {
    if (!selectedClientId) return null;
    return contracts.find((c) => c.clientId === selectedClientId) ?? null;
  }, [selectedClientId, contracts]);

  // Áreas associadas ao cliente selecionado (se não houver vínculo específico, mostra todas as ativas)
  const availableAreas = useMemo(() => {
    if (!selectedClientId) return areas;

    const directAreaIds = clientAreas
      .filter((ca) => ca.clientId === selectedClientId)
      .map((ca) => ca.areaId);

    if (directAreaIds.length > 0) {
      const filtered = areas.filter((a) => directAreaIds.includes(a.id));
      if (filtered.length > 0) return filtered;
    }

    return areas;
  }, [selectedClientId, clientAreas, areas]);

  // Atividades pertencentes à área de atuação selecionada
  const availableActivities = useMemo(() => {
    if (!selectedAreaId) return [];
    return activities.filter((act) => act.area_id === selectedAreaId);
  }, [selectedAreaId, activities]);

  const handleClientChange = (newClientId: string) => {
    setSelectedClientId(newClientId);

    // Identifica as áreas válidas para o novo cliente
    let newAvailableAreas = areas;
    if (newClientId) {
      const directIds = clientAreas.filter((ca) => ca.clientId === newClientId).map((ca) => ca.areaId);
      if (directIds.length > 0) {
        const filtered = areas.filter((a) => directIds.includes(a.id));
        if (filtered.length > 0) newAvailableAreas = filtered;
      }
    }

    // Se a área atual não estiver disponível para o novo cliente, ajusta para a primeira
    if (!newAvailableAreas.some((a) => a.id === selectedAreaId)) {
      const firstArea = newAvailableAreas[0]?.id ?? "";
      setSelectedAreaId(firstArea);
      const actsForFirstArea = activities.filter((act) => act.area_id === firstArea);
      setSelectedActivityId(actsForFirstArea[0]?.id ?? "");
    }
  };

  const handleAreaChange = (newAreaId: string) => {
    setSelectedAreaId(newAreaId);
    const acts = activities.filter((act) => act.area_id === newAreaId);
    if (!acts.some((act) => act.id === selectedActivityId)) {
      setSelectedActivityId(acts[0]?.id ?? "");
    }
  };

  return (
    <>
      <input type="hidden" name="contractId" value={activeContract?.id ?? defaultContractId ?? ""} />

      {/* 1. Cliente */}
      <Field label="Cliente" htmlFor="clientId">
        <NativeSelect
          id="clientId"
          name="clientId"
          value={selectedClientId}
          onChange={(e) => handleClientChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Sem cliente (interno)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        {activeContract ? (
          <p className="mt-1 text-[11px] text-muted-foreground truncate" title={activeContract.name}>
            Contrato: <span className="font-medium text-foreground">{activeContract.name}</span>
          </p>
        ) : selectedClientId ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Sem contrato ativo</p>
        ) : null}
      </Field>

      {/* 2. Área de Atuação */}
      <Field label="Área de atuação" htmlFor="areaId">
        <NativeSelect
          id="areaId"
          name="areaId"
          value={selectedAreaId}
          onChange={(e) => handleAreaChange(e.target.value)}
          disabled={disabled}
          required
        >
          <option value="" disabled>
            {availableAreas.length === 0 ? "Nenhuma área associada" : "Selecione a área"}
          </option>
          {availableAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {/* 3. Atividade */}
      <Field label="Atividade" htmlFor="activityId">
        <NativeSelect
          id="activityId"
          name="activityId"
          value={selectedActivityId}
          onChange={(e) => setSelectedActivityId(e.target.value)}
          disabled={disabled || !selectedAreaId}
          required
        >
          <option value="" disabled>
            {!selectedAreaId
              ? "Selecione a área primeiro"
              : availableActivities.length === 0
              ? "Nenhuma atividade nesta área"
              : "Selecione a atividade"}
          </option>
          {availableActivities.map((act) => (
            <option key={act.id} value={act.id}>
              {act.name}
              {act.billable ? "" : " (não faturável)"}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}

export function EntryForm({
  clients,
  areas,
  activities,
  contracts,
  clientAreas,
  today,
}: {
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  today: string;
}) {
  const [state, formAction] = useActionState(createTimeEntryAction, initialActionState);
  const [useInterval, setUseInterval] = useState(false);

  return (
    <form action={formAction} className="grid gap-4">
      <FormAlert state={state} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Data" htmlFor="entryDate" errors={state.fieldErrors?.entryDate}>
          <Input id="entryDate" name="entryDate" type="date" defaultValue={today} required />
        </Field>

        <CascadeSelectors
          clients={clients}
          areas={areas}
          activities={activities}
          contracts={contracts}
          clientAreas={clientAreas}
        />

        {useInterval ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Início" htmlFor="startTime" errors={state.fieldErrors?.startTime}>
              <Input id="startTime" name="startTime" type="time" required />
            </Field>
            <Field label="Fim" htmlFor="endTime" errors={state.fieldErrors?.endTime}>
              <Input id="endTime" name="endTime" type="time" required />
            </Field>
          </div>
        ) : (
          <Field label="Duração" htmlFor="duration" hint="1:30 · 1,5 · 90m" errors={state.fieldErrors?.duration}>
            <Input id="duration" name="duration" placeholder="1:30" required />
          </Field>
        )}
      </div>

      <Field label="Descrição" htmlFor="description" errors={state.fieldErrors?.description}>
        <Input id="description" name="description" placeholder="O que foi feito no período" />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Lançar horas</SubmitButton>
        <button
          type="button"
          onClick={() => setUseInterval(!useInterval)}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {useInterval ? "Informar apenas a duração" : "Informar horário de início e fim"}
        </button>
      </div>
    </form>
  );
}
