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
      <div className="grid gap-4 sm:grid-cols-4 sm:items-start">
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

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

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

export type EmployeeRow = Tables<"employees"> & {
  employee_costs: Pick<Tables<"employee_costs">, "hourly_cost" | "valid_from" | "valid_to" | "monthly_hours">[];
};

export function EmployeesTable({
  employees,
  canSeeCosts,
  tenantMonthlyHours,
}: {
  employees: EmployeeRow[];
  canSeeCosts: boolean;
  tenantMonthlyHours: number | string;
}) {
  const [filter, setFilter] = useState<"active" | "inactive">("active");

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active !== false),
    [employees]
  );
  const inactiveEmployees = useMemo(
    () => employees.filter((e) => e.active === false),
    [employees]
  );

  const filteredEmployees = useMemo(
    () => (filter === "active" ? activeEmployees : inactiveEmployees),
    [filter, activeEmployees, inactiveEmployees]
  );

  return (
    <>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Equipe</CardTitle>
          <CardDescription>
            {canSeeCosts
              ? "Custo hora vigente hoje."
              : "Você não tem permissão para ver custos individuais — fale com o administrador."}
          </CardDescription>
        </div>

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
              {activeEmployees.length}
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
              {inactiveEmployees.length}
            </span>
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {filteredEmployees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            {filter === "active"
              ? "Nenhum colaborador ativo no momento."
              : "Nenhum colaborador inativo no momento."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Horas/mês</TableHead>
                {canSeeCosts ? <TableHead>Custo hora</TableHead> : null}
                <TableHead>Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => {
                const current = employee.employee_costs?.find((c) => c.valid_to === null);
                const effectiveHours = current?.monthly_hours ?? employee.monthly_hours;
                const isDefault = effectiveHours === null || effectiveHours === undefined;
                const displayHours = effectiveHours ?? tenantMonthlyHours;

                return (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Link href={`/colaboradores/${employee.id}`} className="font-medium hover:underline">
                        {employee.full_name}
                      </Link>
                      {employee.email ? (
                        <p className="text-xs text-muted-foreground">{employee.email}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{employee.job_title ?? "—"}</TableCell>
                    <TableCell>
                      {formatHours(Number(displayHours))}
                      {isDefault ? (
                        <span className="ml-1 text-xs text-muted-foreground">(padrão)</span>
                      ) : null}
                    </TableCell>
                    {canSeeCosts ? (
                      <TableCell>
                        {current ? (
                          formatCurrency(Number(current.hourly_cost))
                        ) : (
                          <span className="text-muted-foreground">sem custo</span>
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      {employee.profile_id ? (
                        <Badge variant="secondary">com login</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">sem acesso</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!employee.active ? (
                          <Badge variant="secondary">inativo</Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            ativo
                          </Badge>
                        )}
                        <EmployeeStatusToggle
                          employeeId={employee.id}
                          active={employee.active}
                          employeeName={employee.full_name}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/colaboradores/${employee.id}`} aria-label={`Abrir ${employee.full_name}`}>
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      </Link>
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
