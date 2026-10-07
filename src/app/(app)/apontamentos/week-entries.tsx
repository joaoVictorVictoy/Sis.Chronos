"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockIcon,
  PencilIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/page-header";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { NativeSelect } from "@/components/native-select";
import { cn } from "@/lib/utils";
import { initialActionState } from "@/lib/actions";
import { formatDate, formatHours } from "@/lib/format";
import { addDays, minutesToInput, WEEKDAY_LABELS } from "@/lib/time";
import type { AppRole, TimeEntryStatus } from "@/lib/database.types";
import { isManager } from "@/lib/auth/session.shared";
import type { ActivityOption, AreaOption, ClientAreaOption, ClientOption, ContractOption, EmployeeOption, TimeEntryWithEmployee } from "./page";
import {
  cancelTimeEntryDeletionAction,
  deleteTimeEntryAction,
  requestTimeEntryDeletionAction,
  reviewDeletionAction,
  updateTimeEntryAction,
} from "./actions";
import { CascadeSelectors } from "./entry-form";

const STATUS_VARIANT: Record<TimeEntryStatus, "default" | "secondary" | "destructive"> = {
  pendente: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
};

const STATUS_LABEL: Record<TimeEntryStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

function isEntryWithin24Hours(entryDate: string, endTime: string | null): boolean {
  try {
    const timeStr = endTime ? (endTime.length === 5 ? `${endTime}:00` : endTime) : "23:59:59";
    const endDateTime = new Date(`${entryDate}T${timeStr}`);
    const timeMs = isNaN(endDateTime.getTime()) ? new Date(entryDate).getTime() : endDateTime.getTime();
    return Date.now() <= timeMs + 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function EntryRow({
  entry,
  clients,
  areas,
  activities,
  contracts,
  clientAreas,
  locked,
  role,
  showEmployee,
}: {
  entry: TimeEntryWithEmployee;
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  locked: boolean;
  role?: AppRole;
  showEmployee?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);

  const [state, formAction] = useActionState(updateTimeEntryAction, initialActionState);
  const [deleteState, deleteAction] = useActionState(deleteTimeEntryAction, initialActionState);
  const [reqDelState, reqDelAction] = useActionState(requestTimeEntryDeletionAction, initialActionState);
  const [cancelDelState, cancelDelAction] = useActionState(cancelTimeEntryDeletionAction, initialActionState);
  const [reviewDelState, reviewDelAction] = useActionState(reviewDeletionAction, initialActionState);

  const contract = contracts.find((c) => c.id === entry.contract_id);
  const activity = activities.find((a) => a.id === entry.activity_id);
  const isManagerUser = role ? isManager(role) : false;
  const canEdit = !locked;
  const isDeletionRequested = Boolean(entry.deletion_requested_at);

  const isWithin24h = isEntryWithin24Hours(entry.entry_date, entry.end_time);
  const canDeleteDirectly =
    isManagerUser ||
    (entry.reviewed_by === null && (entry.status === "pendente" || (entry.status === "aprovado" && isWithin24h)));

  useEffect(() => {
    if (state.success) {
      setEditing(false);
    }
  }, [state.success]);

  useEffect(() => {
    if (reqDelState.success) {
      setRequestingDeletion(false);
    }
  }, [reqDelState.success]);

  if (editing) {
    return (
      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3.5">
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="id" value={entry.id} />
          <FormAlert state={state} />

          {!isManagerUser && (entry.status === "aprovado" || entry.status === "rejeitado" || !isWithin24h) && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <strong>Atenção:</strong> Como este apontamento já passou do prazo de 24 horas ou já foi aprovado, ao salvar a alteração ele voltará para o status <strong>Pendente</strong> para nova aprovação do gestor.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Data" htmlFor={`date-${entry.id}`} errors={state.fieldErrors?.entryDate}>
              <Input id={`date-${entry.id}`} name="entryDate" type="date" defaultValue={entry.entry_date} required />
            </Field>
            <CascadeSelectors
              clients={clients}
              areas={areas}
              activities={activities}
              contracts={contracts}
              clientAreas={clientAreas}
              defaultContractId={entry.contract_id}
              defaultClientId={entry.client_id}
              defaultActivityId={entry.activity_id}
            />
            <Field label="Duração" htmlFor={`duration-${entry.id}`} errors={state.fieldErrors?.duration}>
              <Input id={`duration-${entry.id}`} name="duration" defaultValue={minutesToInput(entry.minutes)} required />
            </Field>
          </div>
          <Field label="Descrição" htmlFor={`desc-${entry.id}`}>
            <Input id={`desc-${entry.id}`} name="description" defaultValue={entry.description ?? ""} />
          </Field>
          <div className="flex items-center gap-2">
            <SubmitButton size="sm">Salvar alteração</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <XIcon />
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (requestingDeletion) {
    return (
      <div className="grid gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3.5">
        <form action={reqDelAction} className="grid gap-3">
          <input type="hidden" name="id" value={entry.id} />
          <FormAlert state={reqDelState} />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Solicitar exclusão ao gestor / administrador</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Este apontamento possui mais de 24 horas ({formatHours(entry.minutes / 60)} em {formatDate(entry.entry_date)}).
              Informe o motivo para que o gestor ou administrador possa avaliar e aprovar a exclusão.
            </p>
          </div>
          <Field label="Motivo da exclusão" htmlFor={`del-reason-${entry.id}`} errors={reqDelState.fieldErrors?.reason}>
            <Input
              id={`del-reason-${entry.id}`}
              name="reason"
              placeholder="Ex.: Lançado por engano / Horas duplicadas no contrato errado"
              required
              minLength={3}
            />
          </Field>
          <div className="flex items-center gap-2">
            <SubmitButton size="sm" variant="destructive">
              Enviar solicitação ao gestor
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRequestingDeletion(false)}>
              <XIcon />
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-2 rounded-lg border px-3 py-2 transition-colors ${
        isDeletionRequested ? "border-amber-500/40 bg-amber-500/[0.04]" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              {formatHours(entry.minutes / 60)}
              <span className="ml-2 font-normal">
                {contract ? `${contract.clientName} · ${contract.name}` : "Interno"}
              </span>
            </p>
            {showEmployee && entry.employees?.full_name ? (
              <Badge variant="outline" className="gap-1 text-xs font-normal text-muted-foreground">
                <UserIcon className="size-3" />
                {entry.employees.full_name}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {activity?.name ?? "Atividade"}
            {entry.billable ? "" : " · não faturável"}
            {entry.description ? ` · ${entry.description}` : ""}
            {entry.start_time && entry.end_time
              ? ` · ${entry.start_time.slice(0, 5)}–${entry.end_time.slice(0, 5)}`
              : ""}
          </p>
          {entry.review_comment ? (
            <p className="text-xs text-muted-foreground">Comentário da gestão: {entry.review_comment}</p>
          ) : null}
          {deleteState.error ? <p className="text-xs text-destructive">{deleteState.error}</p> : null}
          {cancelDelState.error ? <p className="text-xs text-destructive">{cancelDelState.error}</p> : null}
          {reviewDelState.error ? <p className="text-xs text-destructive">{reviewDelState.error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDeletionRequested ? (
            <Badge variant="destructive" className="border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300">
              Exclusão solicitada
            </Badge>
          ) : (
            <Badge variant={STATUS_VARIANT[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
          )}

          {/* Quando HÁ solicitação de exclusão */}
          {isDeletionRequested ? (
            isManagerUser ? (
              <form action={reviewDelAction} className="flex items-center gap-1.5">
                <input type="hidden" name="ids" value={entry.id} />
                <Button
                  type="submit"
                  name="action"
                  value="aprovar"
                  size="xs"
                  variant="destructive"
                  title="Aprovar exclusão (apaga o apontamento)"
                >
                  Aprovar exclusão
                </Button>
                <Button
                  type="submit"
                  name="action"
                  value="rejeitar"
                  size="xs"
                  variant="outline"
                  title="Rejeitar exclusão (mantém o apontamento)"
                >
                  Rejeitar exclusão
                </Button>
              </form>
            ) : (
              <form action={cancelDelAction}>
                <input type="hidden" name="id" value={entry.id} />
                <Button type="submit" variant="outline" size="xs" title="Cancelar solicitação de exclusão">
                  Cancelar solicitação
                </Button>
              </form>
            )
          ) : (
            /* Quando NÃO há solicitação de exclusão */
            <>
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                  aria-label="Alterar apontamento"
                  title="Alterar dados deste apontamento"
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <PencilIcon className="size-3" />
                  <span>Alterar</span>
                </Button>
              ) : null}

              {!locked ? (
                canDeleteDirectly ? (
                  <form
                    action={deleteAction}
                    onSubmit={(e) => {
                      if (!confirm("Deseja realmente apagar este apontamento?")) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={entry.id} />
                    <Button
                      variant="outline"
                      size="sm"
                      type="submit"
                      aria-label="Apagar apontamento"
                      title="Apagar apontamento diretamente (dentro do prazo de 24h)"
                      className="h-7 gap-1 px-2.5 text-xs font-medium text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2Icon className="size-3" />
                      <span>Apagar</span>
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setRequestingDeletion(true)}
                    aria-label="Apagar apontamento"
                    title="Passou de 24 horas: solicitar aprovação do gestor/administrador para apagar"
                    className="h-7 gap-1 px-2.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10"
                  >
                    <Trash2Icon className="size-3" />
                    <span>Apagar</span>
                  </Button>
                )
              ) : null}
            </>
          )}
        </div>
      </div>

      {isDeletionRequested && entry.deletion_reason ? (
        <div className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangleIcon className="mt-0.5 size-3 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Justificativa da exclusão:</strong> {entry.deletion_reason}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function WeekEntries({
  weekStart,
  days,
  entries,
  clients,
  areas,
  activities,
  contracts,
  clientAreas,
  monthlyHours,
  lockedThrough,
  today,
  role,
  employees,
  selectedEmployeeId,
  currentEmployeeId,
}: {
  weekStart: string;
  days: string[];
  entries: TimeEntryWithEmployee[];
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  monthlyHours: number;
  lockedThrough: string | null;
  today: string;
  role?: AppRole;
  employees?: EmployeeOption[];
  selectedEmployeeId?: string;
  currentEmployeeId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const isManagerUser = role ? isManager(role) : false;

  // Jornada diária esperada ≈ jornada mensal ÷ 21 dias úteis
  const dailyTarget = monthlyHours / 21;
  const isAllEmployees = isManagerUser && selectedEmployeeId === "todos";
  const activeEmployeesCount = employees && employees.length > 0 ? employees.length : 1;
  const effectiveDailyTarget = isAllEmployees ? dailyTarget * activeEmployeesCount : dailyTarget;
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const billableMinutes = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.minutes, 0);

  const selectedEmployee =
    selectedEmployeeId && selectedEmployeeId !== "todos"
      ? employees?.find((e) => e.id === selectedEmployeeId)
      : null;

  const buildWeekHref = (targetWeek: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("semana", targetWeek);
    return `/apontamentos?${params.toString()}`;
  };

  const buildTodayHref = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("semana");
    const qs = params.toString();
    return qs ? `/apontamentos?${qs}` : "/apontamentos";
  };

  const handleEmployeeChange = (val: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (val === "todos") {
      params.delete("colaborador");
    } else {
      params.set("colaborador", val);
    }
    router.push(`/apontamentos?${params.toString()}`);
  };

  const subtitleContext = selectedEmployee
    ? `por ${selectedEmployee.name}`
    : isManagerUser && selectedEmployeeId === "todos"
    ? "pela equipe"
    : "";

  const displayDays = selectedDay ? [selectedDay] : days;
  const dayFilteredEntries = selectedDay ? entries.filter((e) => e.entry_date === selectedDay) : entries;
  const dayFilteredMinutes = dayFilteredEntries.reduce((sum, e) => sum + e.minutes, 0);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>Semana de {formatDate(weekStart)}</CardTitle>
          <CardDescription>
            {formatHours(totalMinutes / 60)} apontadas{subtitleContext ? ` ${subtitleContext}` : ""} ·{" "}
            {totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0}% faturável
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isManagerUser && employees && employees.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <UsersIcon className="size-4 shrink-0 text-muted-foreground" />
              <NativeSelect
                value={selectedEmployeeId ?? "todos"}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="h-8 text-xs font-medium"
                aria-label="Selecionar colaborador"
              >
                <option value="todos">Todos os colaboradores</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.id === currentEmployeeId ? " (você)" : ""}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              nativeButton={false}
              render={<Link href={buildWeekHref(addDays(weekStart, -7))} />}
              aria-label="Semana anterior"
            >
              <ChevronLeftIcon />
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={buildTodayHref()} />}>
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              nativeButton={false}
              render={<Link href={buildWeekHref(addDays(weekStart, 7))} />}
              aria-label="Próxima semana"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5">
        {/* 7 dias da semana com clique para selecionar dia */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {days.map((day, i) => {
            const dayEntries = entries.filter((e) => e.entry_date === day);
            const dayMinutes = dayEntries.reduce((sum, e) => sum + e.minutes, 0);
            const ratio = effectiveDailyTarget > 0 ? Math.min(dayMinutes / 60 / effectiveDailyTarget, 1) : 0;
            const isWeekend = i >= 5;
            const isToday = day === today;
            const isLocked = lockedThrough !== null && day <= lockedThrough;
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : day)}
                aria-pressed={isSelected}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 text-center transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring text-left sm:text-center",
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40 shadow-xs text-foreground font-semibold"
                    : isToday
                    ? "border-primary/60 hover:bg-muted/40"
                    : isWeekend
                    ? "bg-muted/40 hover:bg-muted/70"
                    : "hover:bg-muted/40",
                )}
                title={
                  isSelected
                    ? "Clique para remover o filtro deste dia"
                    : `Filtrar por ${WEEKDAY_LABELS[i]} ${day.slice(8, 10)}`
                }
              >
                <div className="flex items-center justify-between sm:justify-center gap-1">
                  <p className={cn("text-xs", isSelected ? "font-semibold text-primary" : "text-muted-foreground")}>
                    {WEEKDAY_LABELS[i]} {day.slice(8, 10)}
                  </p>
                  {isSelected && (
                    <span className="inline-block size-1.5 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-sm font-medium tabular-nums">{dayMinutes ? formatHours(dayMinutes / 60) : "—"}</p>
                <div className="h-1 rounded-full bg-muted">
                  <div className="h-1 rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
                </div>
                {isLocked ? <LockIcon className="mx-auto size-3 text-muted-foreground" /> : null}
              </button>
            );
          })}
        </div>

        {/* Indicador de filtro ativo por dia */}
        {selectedDay ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 shrink-0 text-primary" />
              <span>
                Filtrando por <strong>{formatDate(selectedDay)}</strong>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({dayFilteredEntries.length} {dayFilteredEntries.length === 1 ? "apontamento" : "apontamentos"} · {formatHours(dayFilteredMinutes / 60)})
                </span>
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setSelectedDay(null)}
              className="h-7 text-xs hover:bg-primary/10"
            >
              <XIcon className="mr-1 size-3" />
              Ver todos os dias da semana
            </Button>
          </div>
        ) : null}

        {lockedThrough ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <LockIcon className="size-3" />
            Período fechado até {formatDate(lockedThrough)} — lançamentos nessas datas estão bloqueados.
          </p>
        ) : null}

        <div className="grid gap-4">
          {displayDays.map((day) => {
            const dayEntries = entries.filter((e) => e.entry_date === day);
            if (!dayEntries.length) return null;
            return (
              <div key={day} className="grid gap-2">
                <p className="text-sm font-medium">{formatDate(day)}</p>
                {dayEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    clients={clients}
                    areas={areas}
                    activities={activities}
                    contracts={contracts}
                    clientAreas={clientAreas}
                    locked={lockedThrough !== null && entry.entry_date <= lockedThrough}
                    role={role}
                    showEmployee={isManagerUser && selectedEmployeeId === "todos"}
                  />
                ))}
              </div>
            );
          })}
          {selectedDay && dayFilteredEntries.length === 0 ? (
            <EmptyState>Nenhum apontamento em {formatDate(selectedDay)}.</EmptyState>
          ) : !selectedDay && entries.length === 0 ? (
            <EmptyState>Nenhuma hora apontada nesta semana.</EmptyState>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
