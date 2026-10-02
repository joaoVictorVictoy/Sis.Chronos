"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { EmptyState } from "@/components/page-header";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { initialActionState } from "@/lib/actions";
import { formatCnpj } from "@/lib/format";
import type { Tables } from "@/lib/database.types";
import { createClientAction, setClientAreasAction, updateClientAction } from "./actions";
import { createActivityAction, deleteActivityAction } from "@/app/(app)/cadastros/atividades/actions";

export function NewClientForm() {
  const [state, formAction] = useActionState(createClientAction, initialActionState);

  return (
    <form action={formAction} className="grid gap-4">
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Razão social" htmlFor="legalName" errors={state.fieldErrors?.legalName}>
          <Input id="legalName" name="legalName" required />
        </Field>
        <Field label="Nome fantasia" htmlFor="tradeName" errors={state.fieldErrors?.tradeName}>
          <Input id="tradeName" name="tradeName" />
        </Field>
        <Field label="CNPJ" htmlFor="cnpj" errors={state.fieldErrors?.cnpj}>
          <Input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" />
        </Field>
      </div>
      <div>
        <SubmitButton>Cadastrar cliente</SubmitButton>
      </div>
    </form>
  );
}

export function ClientDetailsForm({ client }: { client: Tables<"clients"> }) {
  const [state, formAction] = useActionState(updateClientAction, initialActionState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="id" value={client.id} />
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Razão social" htmlFor="legalName" errors={state.fieldErrors?.legalName}>
          <Input id="legalName" name="legalName" defaultValue={client.legal_name} required />
        </Field>
        <Field label="Nome fantasia" htmlFor="tradeName" errors={state.fieldErrors?.tradeName}>
          <Input id="tradeName" name="tradeName" defaultValue={client.trade_name ?? ""} />
        </Field>
        <Field label="CNPJ" htmlFor="cnpj" errors={state.fieldErrors?.cnpj}>
          <Input id="cnpj" name="cnpj" defaultValue={formatCnpj(client.cnpj)} />
        </Field>
        <Field label="Contato" htmlFor="contactName" errors={state.fieldErrors?.contactName}>
          <Input id="contactName" name="contactName" defaultValue={client.contact_name ?? ""} />
        </Field>
        <Field label="E-mail" htmlFor="email" errors={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" defaultValue={client.email ?? ""} />
        </Field>
        <Field label="Telefone" htmlFor="phone" errors={state.fieldErrors?.phone}>
          <Input id="phone" name="phone" defaultValue={client.phone ?? ""} />
        </Field>
      </div>
      <Field label="Observações" htmlFor="notes" errors={state.fieldErrors?.notes}>
        <Textarea id="notes" name="notes" defaultValue={client.notes ?? ""} rows={3} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <NativeCheckbox name="active" defaultChecked={client.active} />
        Cliente ativo
      </label>
      <div>
        <SubmitButton>Salvar cliente</SubmitButton>
      </div>
    </form>
  );
}

export function ClientAreasForm({
  clientId,
  areas,
  selected,
}: {
  clientId: string;
  areas: Pick<Tables<"areas">, "id" | "name" | "active">[];
  selected: string[];
}) {
  const [state, formAction] = useActionState(setClientAreasAction, initialActionState);

  if (!areas.length) return <EmptyState>Cadastre áreas de atuação para vincular.</EmptyState>;

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="clientId" value={clientId} />
      <FormAlert state={state} />
      <div className="grid gap-2 sm:grid-cols-2">
        {areas
          .filter((area) => area.active || selected.includes(area.id))
          .map((area) => (
            <label key={area.id} className="flex items-center gap-2 text-sm">
              <NativeCheckbox name="areaIds" value={area.id} defaultChecked={selected.includes(area.id)} />
              {area.name}
              {area.active ? "" : " (inativa)"}
            </label>
          ))}
      </div>
      <div>
        <SubmitButton variant="outline">Salvar áreas</SubmitButton>
      </div>
    </form>
  );
}

export function ClientActivitiesSection({
  clientId,
  clientAreas,
  activities,
}: {
  clientId: string;
  clientAreas: Pick<Tables<"areas">, "id" | "name" | "active">[];
  activities: (Tables<"activities"> & { areas?: { name: string } | null })[];
}) {
  const [createState, createAction] = useActionState(createActivityAction, initialActionState);

  return (
    <div className="grid gap-6">
      {/* Formulário rápido de nova atividade para este cliente */}
      <form action={createAction} className="grid gap-4 rounded-lg border p-4 bg-muted/20">
        <input type="hidden" name="clientId" value={clientId} />
        <FormAlert state={createState} />
        <div className="text-sm font-semibold">Nova Atividade para este Cliente</div>
        <div className="grid gap-4 sm:grid-cols-[1.5fr_2fr_auto_auto] sm:items-end">
          <Field label="Área de Consultoria" htmlFor="clientAreaId" errors={createState.fieldErrors?.areaId}>
            <NativeSelect id="clientAreaId" name="areaId" required>
              <option value="" disabled>
                {clientAreas.length === 0 ? "Nenhuma área associada" : "Selecione a área"}
              </option>
              {clientAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Nome da Atividade" htmlFor="clientActName" errors={createState.fieldErrors?.name}>
            <Input id="clientActName" name="name" required placeholder="Ex.: BPO Financeiro" />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm whitespace-nowrap">
            <NativeCheckbox name="billable" defaultChecked />
            Faturável
          </label>
          <SubmitButton size="sm">Adicionar</SubmitButton>
        </div>
      </form>

      {/* Listagem das atividades deste cliente */}
      {activities.length === 0 ? (
        <EmptyState>Nenhuma atividade cadastrada especificamente para este cliente.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atividade</TableHead>
              <TableHead>Área de Consultoria</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.map((act) => (
              <TableRow key={act.id}>
                <TableCell className="font-medium">{act.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{act.areas?.name ?? "Área"}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {act.billable ? "Faturável" : "Não faturável"}
                </TableCell>
                <TableCell>
                  {act.active ? (
                    <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                      Ativa
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inativa</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DeleteButton
                    action={deleteActivityAction}
                    hiddenFields={{ id: act.id }}
                    title="Excluir atividade"
                    description={`Deseja excluir a atividade "${act.name}" deste cliente?`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
