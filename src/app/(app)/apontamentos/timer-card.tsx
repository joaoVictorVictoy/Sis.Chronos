"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PauseIcon, PlayIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState, type ActionState } from "@/lib/actions";
import type { ActivityOption, AreaOption, ClientAreaOption, ClientOption, ContractOption } from "./page";
import { createTimeEntryAction } from "./actions";
import { CascadeSelectors } from "./entry-form";
import {
  EMPTY_TIMER,
  getTimerServerSnapshot,
  getTimerSnapshot,
  parseTimer,
  saveTimer,
  subscribeTimer,
} from "./timer-store";

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => n.toString().padStart(2, "0")).join(":");
}

export function TimerCard({
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
  const raw = useSyncExternalStore(subscribeTimer, getTimerSnapshot, getTimerServerSnapshot);
  const timer = useMemo(() => parseTimer(raw), [raw]);
  const [now, setNow] = useState(() => Date.now());
  const formRef = useRef<HTMLFormElement>(null);

  // Zera o cronômetro quando o apontamento é criado com sucesso
  const [state, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createTimeEntryAction(prev, formData);
    if (result.success) saveTimer(EMPTY_TIMER);
    return result;
  }, initialActionState);

  useEffect(() => {
    if (timer.startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.startedAt]);

  const seconds = timer.elapsed + (timer.startedAt ? (now - timer.startedAt) / 1000 : 0);
  const running = timer.startedAt !== null;
  const minutes = Math.max(1, Math.round(seconds / 60));

  return (
    <div className="grid gap-4">
      <FormAlert state={state} />
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-mono text-4xl tabular-nums" suppressHydrationWarning>
          {formatClock(seconds)}
        </span>
        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => saveTimer({ ...timer, elapsed: seconds, startedAt: null })}
            >
              <PauseIcon />
              Pausar
            </Button>
          ) : (
            <Button type="button" onClick={() => saveTimer({ ...timer, startedAt: Date.now() })}>
              <PlayIcon />
              {seconds > 0 ? "Retomar" : "Iniciar"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={seconds < 1}
            onClick={() => {
              saveTimer({ ...timer, elapsed: seconds, startedAt: null });
              formRef.current?.requestSubmit();
            }}
          >
            <SquareIcon />
            Parar e lançar
          </Button>
          {seconds > 0 ? (
            <Button type="button" variant="ghost" onClick={() => saveTimer(EMPTY_TIMER)}>
              Descartar
            </Button>
          ) : null}
        </div>
      </div>

      <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="entryDate" value={today} />
        <input type="hidden" name="duration" value={`${minutes}m`} />

        <CascadeSelectors
          clients={clients}
          areas={areas}
          activities={activities}
          contracts={contracts}
          clientAreas={clientAreas}
          defaultContractId={timer.contractId}
          defaultActivityId={timer.activityId}
        />

        <Field label="Descrição" htmlFor="timerDescription">
          <div className="flex gap-2">
            <Input
              id="timerDescription"
              name="description"
              defaultValue={timer.description}
              placeholder="No que você está trabalhando"
            />
            <SubmitButton variant="outline">Lançar</SubmitButton>
          </div>
        </Field>
      </form>
    </div>
  );
}
