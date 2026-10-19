"use client";

import { useActionState, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { EmptyState } from "@/components/page-header";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_RECURRENCE_LABELS } from "@/lib/contracts";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ExpenseRecurrence, Tables } from "@/lib/database.types";
import { createExpenseAction, deleteExpenseAction, setContractLinksAction } from "../actions";

type Option = { id: string; name: string; active: boolean };

function CheckboxGroup({
  title,
  name,
  options,
  selected,
  empty,
}: {
  title: string;
  name: string;
  options: Option[];
  selected: string[];
  empty: string;
}) {
  const [filter, setFilter] = useState("");
  const visible = options.filter((o) => o.active || selected.includes(o.id));
  const filtered = filter.trim()
    ? visible.filter((o) => o.name.toLowerCase().includes(filter.toLowerCase()))
    : visible;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        {visible.length > 5 && (
          <span className="text-[11px] text-muted-foreground">
            {selected.filter((id) => visible.some((v) => v.id === id)).length} de {visible.length}
          </span>
        )}
      </div>

      {visible.length > 7 && (
        <Input
          placeholder={`Buscar em ${title.toLowerCase()}...`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-7 text-xs"
        />
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-1">Nenhum resultado encontrado.</p>
      ) : (
        <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm hover:text-foreground">
              <NativeCheckbox name={name} value={option.id} defaultChecked={selected.includes(option.id)} />
              <span className="truncate">{option.name}</span>
              {option.active ? "" : <span className="text-xs text-muted-foreground">(inativo)</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContractScopeCard({
  contractId,
  areas,
  activities,
  employees,
  selectedAreas,
  selectedActivities,
  selectedEmployees,
}: {
  contractId: string;
  areas: Pick<Tables<"areas">, "id" | "name" | "active">[];
  activities: Pick<Tables<"activities">, "id" | "name" | "active" | "area_id">[];
  employees: Pick<Tables<"employees">, "id" | "full_name" | "active">[];
  selectedAreas: string[];
  selectedActivities: string[];
  selectedEmployees: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const totalSelected = selectedAreas.length + selectedActivities.length + selectedEmployees.length;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle>Escopo e equipe</CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">
              {totalSelected > 0
                ? `${selectedAreas.length} área(s) · ${selectedActivities.length} atividade(s) · ${selectedEmployees.length} colaborador(es)`
                : "Modo aberto (sem restrições)"}
            </Badge>
          </div>
          <CardDescription>
            Áreas, atividades e colaboradores alocados — usados nos filtros e no limite de horas da meta.
          </CardDescription>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          className="gap-1.5 shadow-xs"
        >
          {isOpen ? (
            <>
              <ChevronUpIcon className="size-4" />
              Esconder
            </>
          ) : (
            <>
              <ChevronDownIcon className="size-4" />
              {totalSelected > 0 ? "Ver / Editar escopo" : "Configurar escopo"}
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent>
        {isOpen ? (
          <ContractLinksForm
            contractId={contractId}
            areas={areas}
            activities={activities}
            employees={employees}
            selectedAreas={selectedAreas}
            selectedActivities={selectedActivities}
            selectedEmployees={selectedEmployees}
          />
        ) : (
          <div className="flex flex-col gap-2.5 rounded-lg border border-dashed p-3.5 text-xs text-muted-foreground">
            {totalSelected > 0 ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">Áreas vinculadas:</span>
                  {selectedAreas.length > 0 ? (
                    areas
                      .filter((a) => selectedAreas.includes(a.id))
                      .map((a) => (
                        <Badge key={a.id} variant="outline" className="text-[11px]">
                          {a.name}
                        </Badge>
                      ))
                  ) : (
                    <span className="italic">Todas liberadas</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">Colaboradores alocados:</span>
                  {selectedEmployees.length > 0 ? (
                    employees
                      .filter((e) => selectedEmployees.includes(e.id))
                      .map((e) => (
                        <Badge key={e.id} variant="outline" className="text-[11px]">
                          {e.full_name}
                        </Badge>
                      ))
                  ) : (
                    <span className="italic">Todos da empresa</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">Atividades no escopo:</span>
                  {selectedActivities.length > 0 ? (
                    <span className="text-foreground font-medium">
                      {selectedActivities.length} atividade(s) selecionada(s)
                    </span>
                  ) : (
                    <span className="italic">Todas liberadas</span>
                  )}
                </div>
              </div>
            ) : (
              <p>
                Nenhuma restrição de escopo ou equipe configurada. Qualquer colaborador pode apontar horas neste contrato.
                Clique no botão <strong>"Configurar escopo"</strong> acima para vincular áreas, atividades ou colaboradores específicos.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ContractLinksForm({
  contractId,
  areas,
  activities,
  employees,
  selectedAreas,
  selectedActivities,
  selectedEmployees,
}: {
  contractId: string;
  areas: Pick<Tables<"areas">, "id" | "name" | "active">[];
  activities: Pick<Tables<"activities">, "id" | "name" | "active" | "area_id">[];
  employees: Pick<Tables<"employees">, "id" | "full_name" | "active">[];
  selectedAreas: string[];
  selectedActivities: string[];
  selectedEmployees: string[];
}) {
  const [state, formAction] = useActionState(setContractLinksAction, initialActionState);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="contractId" value={contractId} />
      <FormAlert state={state} />
      <div className="grid gap-6 sm:grid-cols-3">
        <CheckboxGroup
          title="Áreas de atuação"
          name="areaIds"
          options={areas}
          selected={selectedAreas}
          empty="Nenhuma área cadastrada."
        />
        <CheckboxGroup
          title="Atividades"
          name="activityIds"
          options={activities.map((a) => ({ id: a.id, name: a.name, active: a.active }))}
          selected={selectedActivities}
          empty="Nenhuma atividade cadastrada."
        />
        <CheckboxGroup
          title="Colaboradores alocados"
          name="employeeIds"
          options={employees.map((e) => ({ id: e.id, name: e.full_name, active: e.active }))}
          selected={selectedEmployees}
          empty="Nenhum colaborador cadastrado."
        />
      </div>
      <div>
        <SubmitButton variant="outline">Salvar escopo</SubmitButton>
      </div>
    </form>
  );
}

function ExpenseForm({ contractId, today }: { contractId: string; today: string }) {
  const [state, formAction] = useActionState(createExpenseAction, initialActionState);
  const [recurrence, setRecurrence] = useState<ExpenseRecurrence>("pontual");

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="contractId" value={contractId} />
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Descrição" htmlFor="description" className="lg:col-span-2" errors={state.fieldErrors?.description}>
          <Input id="description" name="description" required placeholder="Passagens aéreas" />
        </Field>
        <Field label="Categoria" htmlFor="category" errors={state.fieldErrors?.category}>
          <NativeSelect id="category" name="category" defaultValue="outros">
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Valor" htmlFor="amount" errors={state.fieldErrors?.amount}>
          <Input id="amount" name="amount" inputMode="decimal" required placeholder="800,00" />
        </Field>
        <Field label="Tipo" htmlFor="recurrence" errors={state.fieldErrors?.recurrence}>
          <NativeSelect
            id="recurrence"
            name="recurrence"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as ExpenseRecurrence)}
          >
            {Object.entries(EXPENSE_RECURRENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label={recurrence === "pontual" ? "Data" : "Início"}
          htmlFor="expenseDate"
          errors={state.fieldErrors?.expenseDate}
        >
          <Input id="expenseDate" name="expenseDate" type="date" defaultValue={today} required />
        </Field>
        {recurrence !== "pontual" ? (
          <Field label="Fim (opcional)" htmlFor="endDate" errors={state.fieldErrors?.endDate}>
            <Input id="endDate" name="endDate" type="date" />
          </Field>
        ) : null}
      </div>
      <div>
        <SubmitButton>Adicionar gasto</SubmitButton>
      </div>
    </form>
  );
}

function ExpenseRow({ expense, contractId }: { expense: Tables<"contract_expenses">; contractId: string }) {
  const [state, formAction] = useActionState(deleteExpenseAction, initialActionState);

  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{expense.description}</span>
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </TableCell>
      <TableCell className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[expense.category]}</TableCell>
      <TableCell>{formatCurrency(Number(expense.amount))}</TableCell>
      <TableCell className="text-muted-foreground">
        {EXPENSE_RECURRENCE_LABELS[expense.recurrence]}
        {expense.recurrence !== "pontual" ? (
          <span className="block text-xs">
            {formatDate(expense.expense_date)} — {expense.end_date ? formatDate(expense.end_date) : "sem fim"}
          </span>
        ) : (
          <span className="block text-xs">{formatDate(expense.expense_date)}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <form action={formAction}>
          <input type="hidden" name="id" value={expense.id} />
          <input type="hidden" name="contractId" value={contractId} />
          <SubmitButton variant="ghost" size="icon-sm">
            <Trash2Icon />
          </SubmitButton>
        </form>
      </TableCell>
    </TableRow>
  );
}

export function ExpensesCard({
  contractId,
  expenses,
  today,
}: {
  contractId: string;
  expenses: Tables<"contract_expenses">[];
  today: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos extras</CardTitle>
        <CardDescription>
          Entram no custo total do contrato. Recorrentes são normalizados para o período analisado.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <ExpenseForm contractId={contractId} today={today} />
        {expenses.length === 0 ? (
          <EmptyState>Nenhum gasto extra lançado.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} contractId={contractId} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
