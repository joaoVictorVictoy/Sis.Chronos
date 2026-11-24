"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowUpDownIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { InfoTooltip } from "@/components/info-tooltip";
import { initialActionState, type ActionState } from "@/lib/actions";
import { TimeInput24h } from "@/components/time-input-24h";
import type { ActivityOption, AreaOption, ClientAreaOption, ClientOption, ContractOption } from "./page";
import { createTimeEntryAction } from "./actions";
import {
  getAvailableActivities,
  getAvailableAreas,
  resolveAreaSelection,
  resolveClientSelection,
  resolveContractId,
} from "./cascade";
import { QuickActivityDialog } from "./quick-activity-dialog";

export interface CascadeSelectorsProps {
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  idPrefix?: string;
  selectedClientId?: string;
  onClientChange?: (id: string) => void;
  selectedAreaId?: string;
  onAreaChange?: (id: string) => void;
  selectedActivityId?: string;
  onActivityChange?: (id: string) => void;
  defaultClientId?: string | null;
  defaultAreaId?: string | null;
  defaultActivityId?: string | null;
  defaultContractId?: string | null;
  disabled?: boolean;
  showBillable?: boolean;
}

export function CascadeSelectors({
  clients,
  areas,
  activities,
  contracts,
  clientAreas,
  idPrefix = "",
  selectedClientId: controlledClientId,
  onClientChange,
  selectedAreaId: controlledAreaId,
  onAreaChange,
  selectedActivityId: controlledActivityId,
  onActivityChange,
  defaultClientId,
  defaultAreaId,
  defaultActivityId,
  defaultContractId,
  disabled,
  showBillable = true,
}: CascadeSelectorsProps) {
  const isControlledClient = controlledClientId !== undefined;
  const isControlledArea = controlledAreaId !== undefined;
  const isControlledActivity = controlledActivityId !== undefined;

  // Inicialização inteligente: se o contrato foi passado, busca o cliente desse contrato
  const initialClientId =
    defaultClientId ??
    (defaultContractId ? contracts.find((c) => c.id === defaultContractId)?.clientId ?? "" : "");
  const [internalClientId, setInternalClientId] = useState<string>(initialClientId);

  // Se a atividade foi passada, busca a área dela
  const initialAreaId =
    defaultAreaId ??
    (defaultActivityId ? activities.find((a) => a.id === defaultActivityId)?.area_id ?? "" : "");
  const [internalAreaId, setInternalAreaId] = useState<string>(initialAreaId);

  const [internalActivityId, setInternalActivityId] = useState<string>(defaultActivityId ?? "");
  const [extraActivities, setExtraActivities] = useState<ActivityOption[]>([]);
  const [clientSortMode, setClientSortMode] = useState<"code" | "name">("code");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("chronos_client_sort_order");
      if (saved === "code" || saved === "name") {
        setClientSortMode(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleClientSort = () => {
    const nextMode = clientSortMode === "code" ? "name" : "code";
    setClientSortMode(nextMode);
    try {
      localStorage.setItem("chronos_client_sort_order", nextMode);
    } catch {
      // ignore
    }
  };

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      if (clientSortMode === "name") {
        const nameA = a.legalName || a.name.replace(/^[A-Z0-9]+:\s*/i, "");
        const nameB = b.legalName || b.name.replace(/^[A-Z0-9]+:\s*/i, "");
        return nameA.localeCompare(nameB, "pt-BR", { numeric: true });
      }
      return a.name.localeCompare(b.name, "pt-BR", { numeric: true });
    });
  }, [clients, clientSortMode]);

  // Sincroniza se default mudar externamente no modo não-controlado
  useEffect(() => {
    if (!isControlledClient && defaultClientId !== undefined && defaultClientId !== null) {
      setInternalClientId(defaultClientId);
    }
  }, [isControlledClient, defaultClientId]);

  useEffect(() => {
    if (!isControlledArea && defaultAreaId !== undefined && defaultAreaId !== null) {
      setInternalAreaId(defaultAreaId);
    }
  }, [isControlledArea, defaultAreaId]);

  useEffect(() => {
    if (!isControlledActivity && defaultActivityId !== undefined && defaultActivityId !== null) {
      setInternalActivityId(defaultActivityId);
    }
  }, [isControlledActivity, defaultActivityId]);

  const selectedClientId = isControlledClient ? (controlledClientId ?? "") : internalClientId;
  const selectedAreaId = isControlledArea ? (controlledAreaId ?? "") : internalAreaId;
  const selectedActivityId = isControlledActivity ? (controlledActivityId ?? "") : internalActivityId;

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

  const resolvedContractId = useMemo(
    () =>
      resolveContractId({
        selectedClientId,
        contracts,
        defaultClientId: initialClientId,
        defaultContractId,
      }),
    [selectedClientId, contracts, initialClientId, defaultContractId],
  );

  // Áreas associadas ao cliente selecionado (se não houver vínculo específico, mostra todas as ativas)
  const availableAreas = useMemo(
    () => getAvailableAreas(selectedClientId, areas, clientAreas),
    [selectedClientId, areas, clientAreas],
  );

  // Atividades pertencentes à área selecionada e ao cliente selecionado
  const availableActivities = useMemo(
    () => getAvailableActivities(selectedAreaId, selectedClientId, allActivities),
    [selectedAreaId, selectedClientId, allActivities],
  );

  const safeAreaValue = availableAreas.some((a) => a.id === selectedAreaId) ? selectedAreaId : "";
  const safeActivityValue = availableActivities.some((act) => act.id === selectedActivityId)
    ? selectedActivityId
    : "";

  const applyClientId = (id: string) => {
    if (isControlledClient) onClientChange?.(id);
    else setInternalClientId(id);
  };

  const applyAreaId = (id: string) => {
    if (isControlledArea) onAreaChange?.(id);
    else setInternalAreaId(id);
  };

  const applyActivityId = (id: string) => {
    if (isControlledActivity) onActivityChange?.(id);
    else setInternalActivityId(id);
  };

  const handleClientChange = (newClientId: string) => {
    const next = resolveClientSelection({
      newClientId,
      currentAreaId: selectedAreaId,
      currentActivityId: selectedActivityId,
      areas,
      activities: allActivities,
      clientAreas,
    });

    applyClientId(next.clientId);
    if (next.areaId !== selectedAreaId) {
      applyAreaId(next.areaId);
    }
    if (next.activityId !== selectedActivityId) {
      applyActivityId(next.activityId);
    }
  };

  const handleAreaChange = (newAreaId: string) => {
    const next = resolveAreaSelection({
      newAreaId,
      currentClientId: selectedClientId,
      currentActivityId: selectedActivityId,
      activities: allActivities,
    });

    applyAreaId(next.areaId);
    if (next.activityId !== selectedActivityId) {
      applyActivityId(next.activityId);
    }
  };

  const handleActivityChange = (newActId: string) => {
    applyActivityId(newActId);
  };

  const clientIdAttr = `${idPrefix}clientId`;
  const areaIdAttr = `${idPrefix}areaId`;
  const activityIdAttr = `${idPrefix}activityId`;

  return (
    <>
      <input type="hidden" name="contractId" value={resolvedContractId} />

      {/* 1. Cliente */}
      <div className="grid gap-1.5 min-w-0">
        <div className="flex h-5 items-center justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <Label htmlFor={clientIdAttr} className="shrink-0">Cliente</Label>
            <button
              type="button"
              onClick={toggleClientSort}
              title={`Organização atual: ${clientSortMode === "code" ? "por código (BNR)" : "por nome da empresa (A-Z)"}. Clique para alternar.`}
              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-muted cursor-pointer shrink-0"
            >
              <ArrowUpDownIcon className="size-2.5" />
              <span>{clientSortMode === "code" ? "BNR" : "A-Z"}</span>
            </button>
          </div>
          {activeContract ? (
            <span
              className="text-[10px] text-muted-foreground truncate min-w-0 text-right"
              title={`Contrato ativo vinculado: ${activeContract.name}`}
            >
              Contrato: {activeContract.name}
            </span>
          ) : selectedClientId ? (
            <span className="text-[10px] text-muted-foreground truncate min-w-0 text-right">Sem contrato</span>
          ) : null}
        </div>
        <NativeSelect
          id={clientIdAttr}
          name="clientId"
          value={selectedClientId}
          onChange={(e) => handleClientChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Sem cliente (interno)</option>
          {sortedClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* 2. Área de Atuação */}
      <div className="grid gap-1.5 min-w-0">
        <div className="flex h-5 items-center min-w-0">
          <Label htmlFor={areaIdAttr} className="truncate">Área de atuação</Label>
        </div>
        <NativeSelect
          id={areaIdAttr}
          name="areaId"
          value={safeAreaValue}
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
      <div className="grid gap-1.5 min-w-0">
        <div className="flex h-5 items-center justify-between gap-1 min-w-0">
          <Label htmlFor={activityIdAttr} className="truncate shrink-0">Atividade</Label>
          <QuickActivityDialog
            clients={clients}
            areas={availableAreas.length > 0 ? availableAreas : areas}
            clientAreas={clientAreas}
            initialClientId={selectedClientId}
            initialAreaId={safeAreaValue}
            disabled={disabled}
            onActivityCreated={(newAct) => {
              setExtraActivities((prev) => {
                if (prev.some((a) => a.id === newAct.id)) return prev;
                return [...prev, newAct];
              });
              const targetClientId = newAct.client_id ?? "";
              if (targetClientId !== selectedClientId) {
                applyClientId(targetClientId);
              }
              applyAreaId(newAct.area_id);
              applyActivityId(newAct.id);
            }}
          />
        </div>
        <NativeSelect
          id={activityIdAttr}
          name="activityId"
          value={safeActivityValue}
          onChange={(e) => handleActivityChange(e.target.value)}
          disabled={disabled || !safeAreaValue}
          required
        >
          <option value="" disabled>
            {!safeAreaValue
              ? "Selecione a área primeiro"
              : availableActivities.length === 0
              ? "Nenhuma atividade nesta área"
              : "Selecione a atividade"}
          </option>
          {availableActivities.map((act) => (
            <option key={act.id} value={act.id}>
              {act.name}
              {showBillable && !act.billable ? " (não faturável)" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
    </>
  );
}

export interface EntryFormProps {
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  today: string;
  idPrefix?: string;
  selectedClientId?: string;
  onClientChange?: (id: string) => void;
  selectedAreaId?: string;
  onAreaChange?: (id: string) => void;
  selectedActivityId?: string;
  onActivityChange?: (id: string) => void;
  description?: string;
  onDescriptionChange?: (val: string) => void;
  entryDate?: string;
  onEntryDateChange?: (val: string) => void;
  duration?: string;
  onDurationChange?: (val: string) => void;
  startTime?: string;
  onStartTimeChange?: (val: string) => void;
  endTime?: string;
  onEndTimeChange?: (val: string) => void;
  useInterval?: boolean;
  onUseIntervalChange?: (val: boolean) => void;
  onSuccess?: () => void;
  showBillable?: boolean;
}

export function EntryForm({
  clients,
  areas,
  activities,
  contracts,
  clientAreas,
  today,
  idPrefix = "manual-",
  selectedClientId,
  onClientChange,
  selectedAreaId,
  onAreaChange,
  selectedActivityId,
  onActivityChange,
  description: controlledDescription,
  onDescriptionChange,
  entryDate: controlledEntryDate,
  onEntryDateChange,
  duration: controlledDuration,
  onDurationChange,
  startTime: controlledStartTime,
  onStartTimeChange,
  endTime: controlledEndTime,
  onEndTimeChange,
  useInterval: controlledUseInterval,
  onUseIntervalChange,
  onSuccess,
  showBillable = true,
}: EntryFormProps) {
  const isControlledDescription = controlledDescription !== undefined;
  const isControlledEntryDate = controlledEntryDate !== undefined;
  const isControlledDuration = controlledDuration !== undefined;
  const isControlledStartTime = controlledStartTime !== undefined;
  const isControlledEndTime = controlledEndTime !== undefined;
  const isControlledUseInterval = controlledUseInterval !== undefined;

  const [internalDescription, setInternalDescription] = useState<string>("");
  const [internalEntryDate, setInternalEntryDate] = useState<string>(today);
  const [internalDuration, setInternalDuration] = useState<string>("");
  const [internalStartTime, setInternalStartTime] = useState<string>("");
  const [internalEndTime, setInternalEndTime] = useState<string>("");
  const [internalUseInterval, setInternalUseInterval] = useState<boolean>(false);

  const currentDescription = isControlledDescription ? (controlledDescription ?? "") : internalDescription;
  const currentEntryDate = isControlledEntryDate ? (controlledEntryDate ?? today) : internalEntryDate;
  const currentDuration = isControlledDuration ? (controlledDuration ?? "") : internalDuration;
  const currentStartTime = isControlledStartTime ? (controlledStartTime ?? "") : internalStartTime;
  const currentEndTime = isControlledEndTime ? (controlledEndTime ?? "") : internalEndTime;
  const currentUseInterval = isControlledUseInterval ? Boolean(controlledUseInterval) : internalUseInterval;

  const handleDescriptionChange = (val: string) => {
    if (isControlledDescription) onDescriptionChange?.(val);
    else setInternalDescription(val);
  };

  const handleEntryDateChange = (val: string) => {
    if (isControlledEntryDate) onEntryDateChange?.(val);
    else setInternalEntryDate(val);
  };

  const handleDurationChange = (val: string) => {
    if (isControlledDuration) onDurationChange?.(val);
    else setInternalDuration(val);
  };

  const handleStartTimeChange = (val: string) => {
    if (isControlledStartTime) onStartTimeChange?.(val);
    else setInternalStartTime(val);
  };

  const handleEndTimeChange = (val: string) => {
    if (isControlledEndTime) onEndTimeChange?.(val);
    else setInternalEndTime(val);
  };

  const handleToggleInterval = () => {
    const nextVal = !currentUseInterval;
    if (isControlledUseInterval) onUseIntervalChange?.(nextVal);
    else setInternalUseInterval(nextVal);
  };

  // Usa onSubmit com preventDefault em vez de <form action={...}> para evitar o form.reset()
  // automático do React 19, que dessincronizava visualmente os selects controlados (Cliente/Área/Atividade)
  // e o campo Data após o lançamento.
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createTimeEntryAction(state, formData);
      setState(result);
      if (result.success) {
        handleDurationChange("");
        handleStartTimeChange("");
        handleEndTimeChange("");
        handleDescriptionChange("");
        onSuccess?.();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <FormAlert state={state} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="grid gap-1.5 min-w-0">
          <div className="flex h-5 items-center min-w-0">
            <Label htmlFor={`${idPrefix}entryDate`}>Data</Label>
          </div>
          <Input
            id={`${idPrefix}entryDate`}
            name="entryDate"
            type="date"
            className="h-9"
            value={currentEntryDate}
            onChange={(e) => handleEntryDateChange(e.target.value)}
            required
          />
          {state.fieldErrors?.entryDate ? (
            <p className="text-xs text-destructive">{state.fieldErrors.entryDate[0]}</p>
          ) : null}
        </div>

        <CascadeSelectors
          clients={clients}
          areas={areas}
          activities={activities}
          contracts={contracts}
          clientAreas={clientAreas}
          idPrefix={idPrefix}
          selectedClientId={selectedClientId}
          onClientChange={onClientChange}
          selectedAreaId={selectedAreaId}
          onAreaChange={onAreaChange}
          selectedActivityId={selectedActivityId}
          onActivityChange={onActivityChange}
          showBillable={showBillable}
        />

        {currentUseInterval ? (
          <div className="grid grid-cols-2 gap-2 min-w-0">
            <div className="grid gap-1.5 min-w-0">
              <div className="flex h-5 items-center gap-1.5 min-w-0">
                <Label htmlFor={`${idPrefix}startTime`}>Início (24h)</Label>
                <InfoTooltip text="Formato 24h (ex.: 08:30)" />
              </div>
              <TimeInput24h
                id={`${idPrefix}startTime`}
                name="startTime"
                value={currentStartTime}
                onChange={handleStartTimeChange}
                hasError={Boolean(state.fieldErrors?.startTime)}
                required
              />
              {state.fieldErrors?.startTime ? (
                <p className="text-xs text-destructive">{state.fieldErrors.startTime[0]}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5 min-w-0">
              <div className="flex h-5 items-center gap-1.5 min-w-0">
                <Label htmlFor={`${idPrefix}endTime`}>Fim (24h)</Label>
                <InfoTooltip text="Formato 24h (ex.: 18:00)" />
              </div>
              <TimeInput24h
                id={`${idPrefix}endTime`}
                name="endTime"
                value={currentEndTime}
                onChange={handleEndTimeChange}
                hasError={Boolean(state.fieldErrors?.endTime)}
                required
              />
              {state.fieldErrors?.endTime ? (
                <p className="text-xs text-destructive">{state.fieldErrors.endTime[0]}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-1.5 min-w-0">
            <div className="flex h-5 items-center gap-1.5 min-w-0">
              <Label htmlFor={`${idPrefix}duration`}>Duração</Label>
              <InfoTooltip text="Formatos aceitos: 1:30, 1,5 ou 90m" />
            </div>
            <Input
              id={`${idPrefix}duration`}
              name="duration"
              className="h-9 font-mono"
              placeholder="1:30"
              value={currentDuration}
              onChange={(e) => handleDurationChange(e.target.value)}
              required
            />
            {state.fieldErrors?.duration ? (
              <p className="text-xs text-destructive">{state.fieldErrors.duration[0]}</p>
            ) : null}
          </div>
        )}
      </div>

      <Field label="Descrição" htmlFor={`${idPrefix}description`} errors={state.fieldErrors?.description}>
        <Input
          id={`${idPrefix}description`}
          name="description"
          placeholder="O que foi feito no período"
          value={currentDescription}
          onChange={(e) => handleDescriptionChange(e.target.value)}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={isPending}>Lançar horas</SubmitButton>
        <button
          type="button"
          onClick={handleToggleInterval}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {currentUseInterval ? "Informar apenas a duração" : "Informar horário de início e fim (24h)"}
        </button>
      </div>
    </form>
  );
}
