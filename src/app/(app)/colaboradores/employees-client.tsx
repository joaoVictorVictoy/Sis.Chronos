"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { createEmployeeAction, toggleEmployeeActiveAction } from "./actions";

export function NewEmployeeForm({ defaultMonthlyHours }: { defaultMonthlyHours: number }) {
  const [state, formAction] = useActionState(createEmployeeAction, initialActionState);

  return (
    <form action={formAction} className="grid gap-4">
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-4 sm:items-end">
        <Field label="Nome" htmlFor="fullName" errors={state.fieldErrors?.fullName}>
          <Input id="fullName" name="fullName" required />
        </Field>
        <Field label="E-mail" htmlFor="email" errors={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" />
        </Field>
        <Field label="Cargo" htmlFor="jobTitle" errors={state.fieldErrors?.jobTitle}>
          <Input id="jobTitle" name="jobTitle" placeholder="Analista contábil" />
        </Field>
        <Field
          label="Horas/mês"
          htmlFor="monthlyHours"
          hint={`Padrão: ${defaultMonthlyHours.toLocaleString("pt-BR")}h/mês (≈ ${(defaultMonthlyHours / 21).toFixed(1).replace(".", ",")}h/dia)`}
          errors={state.fieldErrors?.monthlyHours}
        >
          <Input id="monthlyHours" name="monthlyHours" inputMode="decimal" placeholder={String(defaultMonthlyHours)} />
        </Field>
      </div>
      <div>
        <SubmitButton>Cadastrar colaborador</SubmitButton>
      </div>
    </form>
  );
}

export function EmployeeStatusToggle({
  employeeId,
  active,
  employeeName,
}: {
  employeeId: string;
  active: boolean;
  employeeName?: string;
}) {
  const [state, formAction] = useActionState(toggleEmployeeActiveAction, initialActionState);

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {active ? (
        <SubmitButton
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          title={`Desativar ${employeeName ?? "colaborador"}`}
        >
          Desativar
        </SubmitButton>
      ) : (
        <SubmitButton
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
          title={`Reativar ${employeeName ?? "colaborador"}`}
        >
          Ativar
        </SubmitButton>
      )}
      {state.error ? <span className="text-[11px] text-destructive">{state.error}</span> : null}
    </form>
  );
}
