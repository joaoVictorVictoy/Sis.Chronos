"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { EmptyState } from "@/components/page-header";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { initialActionState } from "@/lib/actions";
import { formatCnpj } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import {
  createClientAction,
  deleteClientAction,
  setClientAreasAction,
  toggleClientActiveAction,
  updateClientAction,
} from "./actions";
import { createActivityAction, deleteActivityAction } from "@/app/(app)/cadastros/atividades/actions";
import { TerminateContractDialog } from "@/app/(app)/contratos/[id]/contract-termination";

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

export function ClientDetailsForm({
  client,
  activeContracts = [],
  today = new Date().toISOString().slice(0, 10),
}: {
  client: Tables<"clients">;
  activeContracts?: Tables<"contracts">[];
  today?: string;
}) {
  const [state, formAction] = useActionState(updateClientAction, initialActionState);
  const [isActiveChecked, setIsActiveChecked] = useState(client.active);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);

  const primaryActiveContract = activeContracts[0];

  return (
    <>
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
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <NativeCheckbox
            name="active"
            checked={client.active && primaryActiveContract ? true : isActiveChecked}
            onChange={(e) => {
              const checked = e.target.checked;
              if (!checked && client.active && primaryActiveContract) {
                setTerminateDialogOpen(true);
                return;
              }
              setIsActiveChecked(checked);
            }}
          />
          Cliente ativo
        </label>
        <div>
          <SubmitButton>Salvar cliente</SubmitButton>
        </div>
      </form>

      {primaryActiveContract ? (
        <TerminateContractDialog
          contract={primaryActiveContract}
          otherActiveContractsCount={Math.max(0, activeContracts.length - 1)}
          today={today}
          open={terminateDialogOpen}
          onOpenChange={setTerminateDialogOpen}
          hideTrigger
          forceDeactivateClient
        />
      ) : null}
    </>
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");

  const activeActivities = useMemo(
    () => activities.filter((act) => act.active !== false),
    [activities],
  );
  const inactiveActivities = useMemo(
    () => activities.filter((act) => act.active === false),
    [activities],
  );
  const filteredActivities = statusFilter === "active" ? activeActivities : inactiveActivities;

  return (
    <>
      <CardHeader
        className="flex flex-row items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <CardTitle>Atividades do Cliente</CardTitle>
            <Badge variant="secondary" className="tabular-nums text-xs">
              {activeActivities.length} {activeActivities.length === 1 ? "atividade" : "atividades"}
            </Badge>
          </div>
          <CardDescription>
            Atividades específicas deste cliente organizadas por área de consultoria.
          </CardDescription>
        </div>

        <span
          aria-label={isExpanded ? "Ocultar atividades" : "Expandir atividades"}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
        >
          {isExpanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
        </span>
      </CardHeader>

      {isExpanded ? (
        <CardContent className="grid gap-6">
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
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1 p-1 bg-muted/60 rounded-lg border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5",
                statusFilter === "active"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>Ativas</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                  statusFilter === "active"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {activeActivities.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5",
                statusFilter === "inactive"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>Inativas</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                  statusFilter === "inactive"
                    ? "bg-muted-foreground/20 text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {inactiveActivities.length}
              </span>
            </button>
          </div>

          {filteredActivities.length === 0 ? (
            <EmptyState>
              {statusFilter === "active"
                ? "Nenhuma atividade ativa para este cliente."
                : "Nenhuma atividade inativa para este cliente."}
            </EmptyState>
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
                {filteredActivities.map((act) => (
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
      )}
        </CardContent>
      ) : null}
    </>
  );
}

export type ClientListRow = Tables<"clients"> & {
  contracts: { count: number }[];
};

export function ClientStatusToggle({
  clientId,
  active,
  clientName,
}: {
  clientId: string;
  active: boolean;
  clientName?: string;
}) {
  const [state, formAction] = useActionState(toggleClientActiveAction, initialActionState);

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="id" value={clientId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      {active ? (
        <SubmitButton
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          title={`Desativar ${clientName ?? "cliente"}`}
        >
          Desativar
        </SubmitButton>
      ) : (
        <SubmitButton
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
          title={`Ativar ${clientName ?? "cliente"}`}
        >
          Ativar
        </SubmitButton>
      )}
      {state.error ? <span className="text-[11px] text-destructive">{state.error}</span> : null}
    </form>
  );
}

export function ClientsTable({
  clients,
  isAdmin,
}: {
  clients: ClientListRow[];
  isAdmin: boolean;
}) {
  const [filter, setFilter] = useState<"active" | "inactive">("active");

  const activeClients = useMemo(
    () => clients.filter((c) => c.active !== false),
    [clients]
  );
  const inactiveClients = useMemo(
    () => clients.filter((c) => c.active === false),
    [clients]
  );

  const filteredClients = useMemo(
    () => (filter === "active" ? activeClients : inactiveClients),
    [filter, activeClients, inactiveClients]
  );

  return (
    <>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <CardTitle>Carteira</CardTitle>

        {/* Filtro Ativos | Inativos */}
        <div className="inline-flex items-center gap-1 p-1 bg-muted/60 rounded-lg border border-border/50 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5",
              filter === "active"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Ativos</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                filter === "active"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {activeClients.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("inactive")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5",
              filter === "inactive"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Inativos</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                filter === "inactive"
                  ? "bg-muted-foreground/20 text-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {inactiveClients.length}
            </span>
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {clients.length === 0 ? (
          <EmptyState>Nenhum cliente cadastrado ainda.</EmptyState>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            {filter === "active"
              ? "Nenhum cliente ativo no momento."
              : "Nenhum cliente inativo no momento."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => {
                const contractCount = client.contracts?.[0]?.count ?? 0;
                const displayName = client.trade_name || client.legal_name;
                return (
                  <TableRow key={client.id} className={cn(!client.active && "opacity-75")}>
                    <TableCell>
                      <Link href={`/clientes/${client.id}`} className="font-medium hover:underline">
                        {displayName}
                      </Link>
                      {client.trade_name ? (
                        <p className="text-xs text-muted-foreground">{client.legal_name}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatCnpj(client.cnpj) || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.contact_name ?? "—"}
                      {client.email ? <p className="text-xs">{client.email}</p> : null}
                    </TableCell>
                    <TableCell>
                      {!client.active ? (
                        <Badge variant="secondary">inativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                          ativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && contractCount > 0 ? (
                          <span
                            className="text-xs text-muted-foreground"
                            title="Tem contrato cadastrado. Desative em vez de excluir."
                          >
                            {contractCount} contrato(s)
                          </span>
                        ) : !contractCount ? (
                          <DeleteButton
                            action={deleteClientAction}
                            hiddenFields={{ id: client.id }}
                            title="Excluir cliente"
                            description={`Tem certeza que deseja excluir "${displayName}"? Essa ação não pode ser desfeita.`}
                          />
                        ) : null}
                        <Link href={`/clientes/${client.id}`} aria-label={`Abrir ${client.legal_name}`}>
                          <ChevronRightIcon className="size-4 text-muted-foreground" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </>
  );
}
