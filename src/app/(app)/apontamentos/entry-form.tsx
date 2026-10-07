"use client";

import { useActionState, useCallback, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import type { ActivityOption, AreaOption, ClientAreaOption, ClientOption, ContractOption, EmployeeOption } from "./page";
import { createTimeEntryAction } from "./actions";
import { QuickActivityDialog } from "./quick-activity-dialog";

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
  const [extraActivities, setExtraActivities] = useState<ActivityOption[]>([]);

  const allActivities = useMemo(() => {
    if (extraActivities.length === 0) return activities;
    const existingIds = new Set(activities.map((a) => a.id));
    return [...activities, ...extraActivities.filter((a) => !existingIds.has(a.id))];
  }, [activities, extraActivities]);

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

  // Filtra atividades por área e vínculo com cliente
  const filterActivities = useCallback(
    (areaId: string, clientId: string) => {
      if (!areaId) return [];
      return allActivities.filter((act) => {
        if (act.area_id !== areaId) return false;
        // Se a atividade estiver associada a um cliente específico, só exibe para ele
        if (act.client_id) {
          return act.client_id === clientId;
        }
        // Atividades sem cliente específico (gerais da área) ficam disponíveis
        return true;
      });
    },
    [allActivities],
  );

  // Atividades pertencentes à área selecionada e ao cliente selecionado
  const availableActivities = useMemo(() => {
    return filterActivities(selectedAreaId, selectedClientId);
  }, [selectedAreaId, selectedClientId, filterActivities]);

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
    let targetAreaId = selectedAreaId;
    if (!newAvailableAreas.some((a) => a.id === selectedAreaId)) {
      targetAreaId = newAvailableAreas[0]?.id ?? "";
      setSelectedAreaId(targetAreaId);
    }

    // Atualiza atividade para condizer com o novo cliente + área
    const newActs = filterActivities(targetAreaId, newClientId);
    if (!newActs.some((act) => act.id === selectedActivityId)) {
      setSelectedActivityId(newActs[0]?.id ?? "");
    }
  };

  const handleAreaChange = (newAreaId: string) => {
    setSelectedAreaId(newAreaId);
    const newActs = filterActivities(newAreaId, selectedClientId);
    if (!newActs.some((act) => act.id === selectedActivityId)) {
      setSelectedActivityId(newActs[0]?.id ?? "");
    }
  };

  return (
    <>
      <input type="hidden" name="contractId" value={activeContract?.id ?? defaultContractId ?? ""} />

      {/* 1. Cliente */}
      <div className="grid gap-1.5">
        <div className="flex h-5 items-center justify-between gap-1">
          <Label htmlFor="clientId">Cliente</Label>
          {activeContract ? (
            <span className="text-[11px] text-muted-foreground truncate max-w-[140px]" title={activeContract.name}>
              Contrato: <strong className="font-medium text-foreground">{activeContract.name}</strong>
            </span>
          ) : selectedClientId ? (
            <span className="text-[11px] text-muted-foreground">Sem contrato ativo</span>
          ) : null}
        </div>
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
      </div>

      {/* 2. Área de Atuação */}
      <div className="grid gap-1.5">
        <div className="flex h-5 items-center">
          <Label htmlFor="areaId">Área de atuação</Label>
        </div>
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
      </div>

      {/* 3. Atividade */}
      <div className="grid gap-1.5">
        <div className="flex h-5 items-center justify-between gap-1">
          <Label htmlFor="activityId">Atividade</Label>
          <QuickActivityDialog
            clients={clients}
            areas={availableAreas.length > 0 ? availableAreas : areas}
            clientAreas={clientAreas}
            initialClientId={selectedClientId}
            initialAreaId={selectedAreaId}
            disabled={disabled}
            onActivityCreated={(newAct) => {
              setExtraActivities((prev) => {
                if (prev.some((a) => a.id === newAct.id)) return prev;
                return [...prev, newAct];
              });
              if (newAct.client_id && newAct.client_id !== selectedClientId) {
                handleClientChange(newAct.client_id);
              }
              setSelectedAreaId(newAct.area_id);
              setSelectedActivityId(newAct.id);
            }}
          />
        </div>
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
      </div>
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
  employees,
  selectedEmployeeId,
  currentEmployeeId,
  isManagerUser,
}: {
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  today: string;
  employees?: EmployeeOption[];
  selectedEmployeeId?: string;
  currentEmployeeId?: string | null;
  isManagerUser?: boolean;
}) {
  const [state, formAction] = useActionState(createTimeEntryAction, initialActionState);
  const [useInterval, setUseInterval] = useState(false);
  const initialEmpId =
    selectedEmployeeId && selectedEmployeeId !== "todos"
      ? selectedEmployeeId
      : (currentEmployeeId ?? (employees?.[0]?.id ?? ""));
  const [formEmployeeId, setFormEmployeeId] = useState(initialEmpId);

  return (
    <form action={formAction} className="grid gap-4">
      <FormAlert state={state} />

      <div className={`grid gap-4 sm:grid-cols-2 ${isManagerUser && employees && employees.length > 0 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        <div className="grid gap-1.5">
          <div className="flex h-5 items-center">
            <Label htmlFor="entryDate">Data</Label>
          </div>
          <Input id="entryDate" name="entryDate" type="date" className="h-9" defaultValue={today} required />
          {state.fieldErrors?.entryDate ? (
            <p className="text-xs text-destructive">{state.fieldErrors.entryDate[0]}</p>
          ) : null}
        </div>

        {isManagerUser && employees && employees.length > 0 ? (
          <div className="grid gap-1.5">
            <div className="flex h-5 items-center">
              <Label htmlFor="employeeId">Colaborador</Label>
            </div>
            <NativeSelect
              id="employeeId"
              name="employeeId"
              value={formEmployeeId}
              onChange={(e) => setFormEmployeeId(e.target.value)}
              className="h-9"
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.id === currentEmployeeId ? " (você)" : ""}
                </option>
              ))}
            </NativeSelect>
            {state.fieldErrors?.employeeId ? (
              <p className="text-xs text-destructive">{state.fieldErrors.employeeId[0]}</p>
            ) : null}
          </div>
        ) : null}

        <CascadeSelectors
          clients={clients}
          areas={areas}
          activities={activities}
          contracts={contracts}
          clientAreas={clientAreas}
        />

        {useInterval ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <div className="flex h-5 items-center">
                <Label htmlFor="startTime">Início</Label>
              </div>
              <Input id="startTime" name="startTime" type="time" className="h-9" required />
            </div>
            <div className="grid gap-1.5">
              <div className="flex h-5 items-center">
                <Label htmlFor="endTime">Fim</Label>
              </div>
              <Input id="endTime" name="endTime" type="time" className="h-9" required />
            </div>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <div className="flex h-5 items-center justify-between gap-1">
              <Label htmlFor="duration">Duração</Label>
              <span className="text-[11px] text-muted-foreground">1:30 · 1,5 · 90m</span>
            </div>
            <Input id="duration" name="duration" className="h-9" placeholder="1:30" required />
            {state.fieldErrors?.duration ? (
              <p className="text-xs text-destructive">{state.fieldErrors.duration[0]}</p>
            ) : null}
          </div>
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
