"use client";

import { useActionState, useState } from "react";
import { LockIcon, PencilIcon, RotateCcwIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/actions";
import {
  SUB_REASONS_BY_MAIN_REASON,
  TERMINATION_REASON_LABELS,
  TERMINATION_SUB_REASON_LABELS,
  type TerminationReason,
  type TerminationSubReason,
} from "@/lib/contracts";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Tables } from "@/lib/database.types";
import { reopenContractAction, terminateContractAction } from "../actions";

export function TerminateContractDialog({
  contract,
  otherActiveContractsCount,
  today,
  trigger,
}: {
  contract: Tables<"contracts">;
  otherActiveContractsCount: number;
  today: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<TerminationReason>(
    (contract.termination_reason as TerminationReason) ?? "termino_prazo"
  );
  const [state, formAction] = useActionState(async (prev: any, formData: FormData) => {
    const result = await terminateContractAction(prev, formData);
    if (result.success) setOpen(false);
    return result;
  }, initialActionState);

  const defaultDate = contract.terminated_at || contract.end_date || today;
  const isEditing = contract.status === "encerrado";
  const subReasons = SUB_REASONS_BY_MAIN_REASON[reason] ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
            >
              <LockIcon className="size-4" />
              Encerrar contrato
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Ajustar Dados da Rescisão" : "Encerrar ou Rescindir Contrato"}</DialogTitle>
          <DialogDescription>
            Defina o motivo estratégico, a data de corte e eventuais valores de multa ou aviso prévio indenizado.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="contractId" value={contract.id} />
          <FormAlert state={state} />

          <Field label="Tipo / Motivo do encerramento" htmlFor="terminationReason" errors={state.fieldErrors?.terminationReason}>
            <NativeSelect
              id="terminationReason"
              name="terminationReason"
              value={reason}
              onChange={(e) => setReason(e.target.value as TerminationReason)}
              required
            >
              {Object.entries(TERMINATION_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="Causa específica (Churn Analysis)"
            htmlFor="terminationSubReason"
            hint="Classificação para análise de gargalos operacionais e atendimento no dashboard."
            errors={state.fieldErrors?.terminationSubReason}
          >
            <NativeSelect
              id="terminationSubReason"
              name="terminationSubReason"
              defaultValue={contract.termination_sub_reason ?? subReasons[0]?.value ?? ""}
            >
              {subReasons.map((sub) => (
                <option key={sub.value} value={sub.value}>
                  {sub.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="Data de término / corte"
            htmlFor="terminatedAt"
            hint="Apontamentos de horas após esta data são bloqueados para este contrato."
            errors={state.fieldErrors?.terminatedAt}
          >
            <Input id="terminatedAt" name="terminatedAt" type="date" defaultValue={defaultDate} required />
          </Field>

          <Field
            label="Multa rescisória / Receita extraordinária (R$)"
            htmlFor="terminationPenalty"
            hint="Opcional. Valor extraordinário da rescisão (ex: 50% das parcelas restantes ou aviso prévio). Será somado à receita final para apurar o lucro."
            errors={state.fieldErrors?.terminationPenalty}
          >
            <Input
              id="terminationPenalty"
              name="terminationPenalty"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                contract.termination_penalty
                  ? String(Number(contract.termination_penalty)).replace(".", ",")
                  : ""
              }
            />
          </Field>

          <Field
            label="Observações / Justificativa"
            htmlFor="terminationNotes"
            hint="Opcional. Registre detalhes, aprendizados e acordos da rescisão."
            errors={state.fieldErrors?.terminationNotes}
          >
            <Textarea
              id="terminationNotes"
              name="terminationNotes"
              defaultValue={contract.termination_notes ?? ""}
              placeholder="Ex.: Projeto concluído no prazo / Cliente optou por corte de custos geral..."
              rows={3}
            />
          </Field>

          {otherActiveContractsCount === 0 ? (
            <label className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <NativeCheckbox name="deactivateClient" defaultChecked className="mt-0.5" />
              <span>
                <strong className="block font-medium">Inativar o cadastro do cliente</strong>
                <span className="text-xs text-muted-foreground">
                  Este é o único contrato ativo deste cliente. Ao inativar, ele não aparecerá mais na lista de
                  apontamentos da equipe.
                </span>
              </span>
            </label>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              O cliente continuará ativo pois ainda possui <strong>{otherActiveContractsCount}</strong> outro(s) contrato(s)
              vigente(s).
            </div>
          )}

          <DialogFooter className="mt-2">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <SubmitButton variant="destructive">
              {isEditing ? "Salvar alterações" : "Confirmar encerramento"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TerminationBanner({
  contract,
  otherActiveContractsCount = 0,
  today,
}: {
  contract: Tables<"contracts">;
  otherActiveContractsCount?: number;
  today?: string;
}) {
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenState, reopenFormAction] = useActionState(async (prev: any, formData: FormData) => {
    const result = await reopenContractAction(prev, formData);
    if (result.success) setReopenOpen(false);
    return result;
  }, initialActionState);

  const reasonKey = contract.termination_reason as TerminationReason | null;
  const reasonLabel = reasonKey ? TERMINATION_REASON_LABELS[reasonKey] ?? reasonKey : "Não informado";

  const subReasonKey = contract.termination_sub_reason as TerminationSubReason | null;
  const subReasonLabel = subReasonKey ? TERMINATION_SUB_REASON_LABELS[subReasonKey] ?? subReasonKey : null;

  const cutOffDate = contract.terminated_at || contract.end_date;
  const penalty = Number(contract.termination_penalty) || 0;

  const isDeliveryIssue = subReasonKey === "insatisfacao" || subReasonKey === "escopo_inviavel";

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <XCircleIcon className="size-5 text-destructive shrink-0" />
            <CardTitle className="text-base font-semibold text-destructive">
              Contrato Encerrado
            </CardTitle>
          </div>
          <CardDescription className="text-foreground/80">
            {cutOffDate ? `Encerrado em ${formatDate(cutOffDate)}.` : "Contrato com vigência finalizada."}{" "}
            Motivo: <strong>{reasonLabel}</strong>
          </CardDescription>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            {subReasonLabel ? (
              <Badge variant={isDeliveryIssue ? "destructive" : "secondary"} className="text-xs">
                {subReasonLabel}
              </Badge>
            ) : null}

            {penalty > 0 ? (
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                Multa rescisória: <strong>{formatCurrency(penalty)}</strong>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <TerminateContractDialog
            contract={contract}
            otherActiveContractsCount={otherActiveContractsCount}
            today={today ?? cutOffDate ?? ""}
            trigger={
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <PencilIcon className="size-3.5" />
                Ajustar rescisão
              </Button>
            }
          />

          <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
            <DialogTrigger
              render={
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                  <RotateCcwIcon className="size-3.5" />
                  Reabrir contrato
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reabrir Contrato</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja reativar este contrato? Ele voltará a ficar ativo, aceitará novos apontamentos
                  da equipe e os dados de encerramento serão redefinidos.
                </DialogDescription>
              </DialogHeader>
              <form action={reopenFormAction} className="grid gap-4">
                <input type="hidden" name="contractId" value={contract.id} />
                <FormAlert state={reopenState} />
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
                  <SubmitButton>Reativar contrato</SubmitButton>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 pt-0">
        {contract.termination_notes ? (
          <div className="rounded-md border bg-background/50 p-3 text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Observações do encerramento
            </span>
            <p className="whitespace-pre-wrap text-foreground/90">{contract.termination_notes}</p>
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LockIcon className="size-3.5 shrink-0" />
          <span>Novos apontamentos de horas vinculados a este contrato estão bloqueados.</span>
        </div>
      </CardContent>
    </Card>
  );
}
