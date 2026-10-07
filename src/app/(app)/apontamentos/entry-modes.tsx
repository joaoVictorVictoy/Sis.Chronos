"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { PencilLineIcon, TimerIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { minutesToInput } from "@/lib/time";
import type { ActivityOption, AreaOption, ClientAreaOption, ClientOption, ContractOption } from "./page";
import { EntryForm } from "./entry-form";
import { TimerCard } from "./timer-card";
import {
  getTimerServerSnapshot,
  getTimerSnapshot,
  parseTimer,
  subscribeTimer,
} from "./timer-store";

const MODES = [
  { id: "cronometro", label: "Cronômetro", icon: TimerIcon },
  { id: "manual", label: "Lançamento manual", icon: PencilLineIcon },
] as const;

type Mode = (typeof MODES)[number]["id"];

/** Alterna entre cronômetro e lançamento manual, mantendo todas as informações selecionadas. */
export function EntryModes({
  clients,
  areas,
  activities,
  contracts,
  clientAreas,
  today,
  lockedThrough,
}: {
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  today: string;
  lockedThrough: string | null;
}) {
  const [mode, setMode] = useState<Mode>("cronometro");

  const raw = useSyncExternalStore(subscribeTimer, getTimerSnapshot, getTimerServerSnapshot);
  const timer = useMemo(() => parseTimer(raw), [raw]);

  // Valores iniciais derivados do timer salvo
  const initialClientId = useMemo(() => {
    if (timer.clientId) return timer.clientId;
    if (timer.contractId) {
      return contracts.find((c) => c.id === timer.contractId)?.clientId ?? "";
    }
    return "";
  }, [timer.clientId, timer.contractId, contracts]);

  const initialAreaId = useMemo(() => {
    if (timer.areaId) return timer.areaId;
    if (timer.activityId) {
      return activities.find((a) => a.id === timer.activityId)?.area_id ?? "";
    }
    return "";
  }, [timer.areaId, timer.activityId, activities]);

  // Estado compartilhado entre cronômetro e lançamento manual
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(initialAreaId);
  const [selectedActivityId, setSelectedActivityId] = useState<string>(timer.activityId || "");
  const [description, setDescription] = useState<string>(timer.description || "");
  const [entryDate, setEntryDate] = useState<string>(today);
  const [duration, setDuration] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [useInterval, setUseInterval] = useState<boolean>(false);

  // Ao trocar para inserção manual, preserva todas as seleções e, se houver tempo no cronômetro,
  // pré-preenche o campo de duração caso esteja vazio
  const handleModeSwitch = (nextMode: Mode) => {
    if (nextMode === "manual" && mode === "cronometro") {
      const seconds = timer.elapsed + (timer.startedAt ? (Date.now() - timer.startedAt) / 1000 : 0);
      if (seconds >= 60 && !duration) {
        const minutes = Math.max(1, Math.round(seconds / 60));
        setDuration(minutesToInput(minutes));
      }
    }
    setMode(nextMode);
  };

  const handleEntrySuccess = () => {
    setDescription("");
    setDuration("");
    setStartTime("");
    setEndTime("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>{mode === "cronometro" ? "Cronômetro" : "Lançamento manual"}</CardTitle>
          <CardDescription>
            {mode === "cronometro"
              ? "Continua contando se você fechar a página. Ao parar, o tempo vira um apontamento pendente."
              : `Informe a duração (1:30, 1,5 ou 90m) ou o intervalo de horas (formato 24h).${
                  lockedThrough ? " Datas de períodos fechados são bloqueadas." : ""
                }`}
          </CardDescription>
        </div>

        <div role="tablist" aria-label="Forma de lançamento" className="flex rounded-lg border bg-muted/40 p-0.5">
          {MODES.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleModeSwitch(item.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors cursor-pointer",
                  active ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        <div className={mode === "cronometro" ? "block" : "hidden"}>
          <TimerCard
            clients={clients}
            areas={areas}
            activities={activities}
            contracts={contracts}
            clientAreas={clientAreas}
            today={today}
            idPrefix="timer-"
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
            selectedAreaId={selectedAreaId}
            onAreaChange={setSelectedAreaId}
            selectedActivityId={selectedActivityId}
            onActivityChange={setSelectedActivityId}
            description={description}
            onDescriptionChange={setDescription}
            entryDate={entryDate}
            onEntryDateChange={setEntryDate}
            onSuccess={handleEntrySuccess}
          />
        </div>
        <div className={mode === "manual" ? "block" : "hidden"}>
          <EntryForm
            clients={clients}
            areas={areas}
            activities={activities}
            contracts={contracts}
            clientAreas={clientAreas}
            today={today}
            idPrefix="manual-"
            selectedClientId={selectedClientId}
            onClientChange={setSelectedClientId}
            selectedAreaId={selectedAreaId}
            onAreaChange={setSelectedAreaId}
            selectedActivityId={selectedActivityId}
            onActivityChange={setSelectedActivityId}
            description={description}
            onDescriptionChange={setDescription}
            entryDate={entryDate}
            onEntryDateChange={setEntryDate}
            duration={duration}
            onDurationChange={setDuration}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            endTime={endTime}
            onEndTimeChange={setEndTime}
            useInterval={useInterval}
            onUseIntervalChange={setUseInterval}
            onSuccess={handleEntrySuccess}
          />
        </div>
      </CardContent>
    </Card>
  );
}
