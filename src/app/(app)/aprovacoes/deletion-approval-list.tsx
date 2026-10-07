"use client";

import { useActionState, useState } from "react";
import { AlertTriangleIcon, Trash2Icon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeCheckbox } from "@/components/native-select";
import { FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { formatDate, formatHours } from "@/lib/format";
import type { PendingEntry } from "./page";
import { reviewDeletionAction } from "../apontamentos/actions";

export function DeletionApprovalList({ requests }: { requests: PendingEntry[] }) {
  const [state, formAction] = useActionState(reviewDeletionAction, initialActionState);
  const [selected, setSelected] = useState<string[]>([]);

  const allSelected = selected.length === requests.length && requests.length > 0;
  const toggleAll = () => setSelected(allSelected ? [] : requests.map((e) => e.id));
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <form action={formAction} className="grid gap-4">
      <FormAlert state={state} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid flex-1 gap-1.5">
          <label htmlFor="deletion-comment" className="text-sm font-medium">
            Comentário da gestão (opcional, registrado ao rejeitar a exclusão)
          </label>
          <Input id="deletion-comment" name="comment" placeholder="Ex.: Horas já faturadas no período / Manter lançamento" />
        </div>
        <SubmitButton name="action" value="aprovar" variant="destructive">
          <Trash2Icon />
          Aprovar exclusão (remover apontamento)
        </SubmitButton>
        <SubmitButton name="action" value="rejeitar" variant="outline">
          <XIcon />
          Rejeitar exclusão (manter apontamento)
        </SubmitButton>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <NativeCheckbox checked={allSelected} onChange={toggleAll} aria-label="Selecionar todas as solicitações" />
            </TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Cliente / contrato</TableHead>
            <TableHead>Atividade</TableHead>
            <TableHead>Motivo da exclusão</TableHead>
            <TableHead className="text-right">Horas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((entry) => (
            <TableRow key={entry.id} className="bg-destructive/[0.02]">
              <TableCell>
                <NativeCheckbox
                  checked={selected.includes(entry.id)}
                  onChange={() => toggle(entry.id)}
                  aria-label={`Selecionar solicitação de ${entry.employees?.full_name ?? ""}`}
                />
              </TableCell>
              <TableCell className="font-medium">{entry.employees?.full_name ?? "—"}</TableCell>
              <TableCell>{formatDate(entry.entry_date)}</TableCell>
              <TableCell>
                {entry.contracts ? (
                  <>
                    <span className="block font-medium">
                      {entry.contracts.clients?.trade_name || entry.contracts.clients?.legal_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{entry.contracts.name}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Interno</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <span className="block text-foreground font-medium">{entry.activities?.name}</span>
                {entry.description ? <span className="block text-xs">{entry.description}</span> : null}
              </TableCell>
              <TableCell>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-1 font-semibold mb-0.5">
                    <AlertTriangleIcon className="size-3 text-amber-600 dark:text-amber-400" />
                    Justificativa:
                  </div>
                  <p>{entry.deletion_reason || "Sem justificativa informada."}</p>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{formatHours(entry.minutes / 60)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </form>
  );
}
