"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, PencilIcon, Trash2Icon, XIcon, AlertTriangleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/page-header";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { formatDate, formatHours } from "@/lib/format";
import { addDays, minutesToInput, WEEKDAY_LABELS } from "@/lib/time";
import type { AppRole, Tables, TimeEntryStatus } from "@/lib/database.types";
import { isManager } from "@/lib/auth/session.shared";
import type { ActivityOption, AreaOption, ClientAreaOption, ClientOption, ContractOption } from "./page";
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

function EntryRow({
  entry,
  clients,
  areas,
  activities,
  contracts,
  clientAreas,
  locked,
  role,
}: {
  entry: Tables<"time_entries">;
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  locked: boolean;
  role?: AppRole;
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

  if (editing) {
    return (
      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="id" value={entry.id} />
          <FormAlert state={state} />

          {!isManagerUser && (entry.status === "aprovado" || entry.status === "rejeitado") && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <strong>Atenção:</strong> Como este apontamento já foi revisado, ao salvar a correção ele voltará para o status <strong>Pendente</strong> para nova aprovação do gestor.
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
            <SubmitButton size="sm">Salvar correção</SubmitButton>
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
      <div className="grid gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <form action={reqDelAction} className="grid gap-3">
          <input type="hidden" name="id" value={entry.id} />
          <FormAlert state={reqDelState} />
          <div>
            <p className="text-sm font-semibold text-destructive">Solicitar exclusão do apontamento</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Este apontamento está aprovado ({formatHours(entry.minutes / 60)} em {formatDate(entry.entry_date)}).
              Informe a justificativa para que o gestor ou administrador possa avaliar e aprovar a exclusão.
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
              Enviar solicitação de exclusão
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
          <p className="font-medium">
            {formatHours(entry.minutes / 60)}
            <span className="ml-2 font-normal">
              {contract ? `${contract.clientName} · ${contract.name}` : "Interno"}
            </span>
          </p>
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
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditing(true)}
                  aria-label="Editar"
                  title="Editar / Corrigir apontamento"
                >
                  <PencilIcon />
                </Button>
              ) : null}

              {!locked ? (
                isManagerUser || entry.status === "pendente" ? (
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="submit"
                      aria-label="Excluir"
                      title="Excluir apontamento"
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2Icon />
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    onClick={() => setRequestingDeletion(true)}
                    aria-label="Solicitar exclusão"
                    title="Solicitar exclusão ao gestor"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2Icon />
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
}: {
  weekStart: string;
  days: string[];
  entries: Tables<"time_entries">[];
  clients: ClientOption[];
  areas: AreaOption[];
  activities: ActivityOption[];
  contracts: ContractOption[];
  clientAreas: ClientAreaOption[];
  monthlyHours: number;
  lockedThrough: string | null;
  today: string;
  role?: AppRole;
}) {
  // Jornada diária esperada ≈ jornada mensal ÷ 21 dias úteis
  const dailyTarget = monthlyHours / 21;
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const billableMinutes = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.minutes, 0);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Semana de {formatDate(weekStart)}</CardTitle>
          <CardDescription>
            {formatHours(totalMinutes / 60)} apontadas ·{" "}
            {totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0}% faturável
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={`/apontamentos?semana=${addDays(weekStart, -7)}`} />}
            aria-label="Semana anterior"
          >
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/apontamentos" />}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={`/apontamentos?semana=${addDays(weekStart, 7)}`} />}
            aria-label="Próxima semana"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, i) => {
            const dayEntries = entries.filter((e) => e.entry_date === day);
            const dayMinutes = dayEntries.reduce((sum, e) => sum + e.minutes, 0);
            const ratio = dailyTarget > 0 ? Math.min(dayMinutes / 60 / dailyTarget, 1) : 0;
            const isWeekend = i >= 5;
            const isToday = day === today;
            const isLocked = lockedThrough !== null && day <= lockedThrough;

            return (
              <div
                key={day}
                className={`grid gap-1 rounded-lg border p-2 text-center ${isToday ? "border-primary" : ""} ${
                  isWeekend ? "bg-muted/40" : ""
                }`}
              >
                <p className="text-xs text-muted-foreground">
                  {WEEKDAY_LABELS[i]} {day.slice(8, 10)}
                </p>
                <p className="text-sm font-medium tabular-nums">{dayMinutes ? formatHours(dayMinutes / 60) : "—"}</p>
                <div className="h-1 rounded-full bg-muted">
                  <div className="h-1 rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
                </div>
                {isLocked ? <LockIcon className="mx-auto size-3 text-muted-foreground" /> : null}
              </div>
            );
          })}
        </div>

        {lockedThrough ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <LockIcon className="size-3" />
            Período fechado até {formatDate(lockedThrough)} — lançamentos nessas datas estão bloqueados.
          </p>
        ) : null}

        <div className="grid gap-4">
          {days.map((day) => {
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
                  />
                ))}
              </div>
            );
          })}
          {entries.length === 0 ? <EmptyState>Nenhuma hora apontada nesta semana.</EmptyState> : null}
        </div>
      </CardContent>
    </Card>
  );
}
