"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { CopyLink } from "@/components/copy-link";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import type { AppRole } from "@/lib/database.types";
import { inviteMemberAction } from "./actions";

const ROLE_HINTS: Record<AppRole, string> = {
  admin: "Acesso total, inclusive custos.",
  gestor: "Dashboards e aprovações.",
  colaborador: "Apenas próprios apontamentos.",
};

export function InviteForm() {
  const [state, formAction] = useActionState(inviteMemberAction, initialActionState);
  const [role, setRole] = useState<AppRole>("colaborador");

  return (
    <form action={formAction} className="grid gap-4">
      <FormAlert state={state} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        <Field label="Nome" htmlFor="fullName" errors={state.fieldErrors?.fullName} className="w-full sm:w-56">
          <Input id="fullName" name="fullName" required placeholder="Nome completo" />
        </Field>

        <Field label="E-mail" htmlFor="email" errors={state.fieldErrors?.email} className="w-full sm:w-64">
          <Input id="email" name="email" type="email" required placeholder="email@empresa.com.br" />
        </Field>

        <Field
          label="Perfil de acesso"
          htmlFor="role"
          hint={ROLE_HINTS[role]}
          errors={state.fieldErrors?.role}
          className="w-full sm:w-36 shrink-0"
        >
          <NativeSelect
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="w-full"
          >
            <option value="colaborador">Colaborador</option>
            <option value="gestor">Gestor</option>
            <option value="admin">Administrador</option>
          </NativeSelect>
        </Field>

        <div className="grid gap-1.5 shrink-0">
          <span className="hidden sm:block text-sm font-medium invisible select-none" aria-hidden="true">
            Botão
          </span>
          <SubmitButton className="w-full sm:w-auto">Enviar convite</SubmitButton>
        </div>
      </div>

      {role === "gestor" ? (
        <label className="flex items-center gap-2 text-sm">
          <NativeCheckbox name="canViewCosts" />
          Pode ver o custo individual dos colaboradores
        </label>
      ) : null}

      {state.link ? <CopyLink link={state.link} /> : null}
    </form>
  );
}
