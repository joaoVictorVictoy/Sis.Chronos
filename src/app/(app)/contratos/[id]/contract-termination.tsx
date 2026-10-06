"use client";

import { useActionState, useState } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, LockIcon, RotateCcwIcon, XCircleIcon } from "lucide-react";
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
import { TERMINATION_REASON_LABELS, type TerminationReason } from "@/lib/contracts";
import { formatDate } from "@/lib/format";
import type { Tables } from "@/lib/database.types";
import { reopenContractAction, terminateContractAction } from "../actions";

export function TerminateContractDialog({
  contract,
  otherActiveContractsCount,
  today,
}: {
  contract: Tables<"contracts">;
  otherActiveContractsCount: number;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: any, formData: FormData) => {
    const result = await terminateContractAction(prev, formData);
    if (result.success) setOpen(false);
    return result;
  }, initialActionState);

  const defaultDate = contract.end_date || today;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          >
            <LockIcon className="size-4" />
            Encerrar contrato
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Encerrar ou Rescindir Contrato</DialogTitle>
          <DialogDescription>
            Defina o motivo do encerramento, a data de corte e as diretrizes operacionais para apontamentos.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="contractId" value={contract.id} />
          <FormAlert state={state} />

          <Field label="Motivo do encerramento" htmlFor="terminationReason" errors={state.fieldErrors?.terminationReason}>
            <NativeSelect id="terminationReason" name="terminationReason" defaultValue="termino_prazo" required>
              {Object.entries(TERMINATION_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="Data de término / corte"
            htmlFor="terminatedAt"
            hint="Apontamentos de horas após esta data serão bloqueados para este contrato."
            errors={state.fieldErrors?.terminatedAt}
          >
            <Input id="terminatedAt" name="terminatedAt" type="date" defaultValue={defaultDate} required />
          </Field>

          <Field
            label="Observações / Justificativa"
            htmlFor="terminationNotes"
            hint="Opcional. Registre aprendizados, alinhamentos ou motivos da saída."
            errors={state.fieldErrors?.terminationNotes}
          >
            <Textarea
              id="terminationNotes"
              name="terminationNotes"
              placeholder="Ex.: Projeto concluído no prazo / Cliente optou por rescisão antecipada..."
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
            <SubmitButton variant="destructive">Confirmar encerramento</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TerminationBanner({ contract }: { contract: Tables<"contracts"> }) {
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenState, reopenFormAction] = useActionState(async (prev: any, formData: FormData) => {
    const result = await reopenContractAction(prev, formData);
    if (result.success) setReopenOpen(false);
    return result;
  }, initialActionState);

  const reasonKey = contract.termination_reason as TerminationReason | null;
  const reasonLabel = reasonKey ? TERMINATION_REASON_LABELS[reasonKey] ?? reasonKey : "Não informado";
  const cutOffDate = contract.terminated_at || contract.end_date;

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
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
        </div>

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogTrigger
            render={
              <Button type="button" variant="outline" size="sm" className="self-start">
                <RotateCcwIcon className="size-3.5" />
                Reabrir contrato
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reabrir Contrato</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja reativar este contrato? Ele voltará a ficar ativo e aceitará novos apontamentos
                da equipe.
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
