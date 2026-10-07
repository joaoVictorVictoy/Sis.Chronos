"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { EmptyState } from "@/components/page-header";
import { CopyLink } from "@/components/copy-link";
import { DeleteButton } from "@/components/delete-button";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { initialActionState } from "@/lib/actions";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import type { Tables } from "@/lib/database.types";
import {
  deleteEmployeeCostAction,
  grantAccessAction,
  setEmployeeAreasAction,
  setEmployeeCostAction,
  updateEmployeeAction,
} from "../actions";

export function EmployeeDetailsForm({
  employee,
  defaultMonthlyHours,
}: {
  employee: Tables<"employees">;
  defaultMonthlyHours: number;
}) {
  const [state, formAction] = useActionState(updateEmployeeAction, initialActionState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="id" value={employee.id} />
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="fullName" errors={state.fieldErrors?.fullName}>
          <Input id="fullName" name="fullName" defaultValue={employee.full_name} required />
        </Field>
        <Field label="E-mail" htmlFor="email" errors={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" defaultValue={employee.email ?? ""} />
        </Field>
        <Field label="Cargo" htmlFor="jobTitle" errors={state.fieldErrors?.jobTitle}>
          <Input id="jobTitle" name="jobTitle" defaultValue={employee.job_title ?? ""} />
        </Field>
        <Field
          label="Horas disponíveis no mês"
          htmlFor="monthlyHours"
          hint={`Vazio usa o padrão da empresa (${defaultMonthlyHours.toLocaleString("pt-BR")}h/mês ≈ ${(defaultMonthlyHours / 21).toFixed(1).replace(".", ",")}h/dia).`}
          errors={state.fieldErrors?.monthlyHours}
        >
          <Input
            id="monthlyHours"
            name="monthlyHours"
            inputMode="decimal"
            defaultValue={employee.monthly_hours === null ? "" : Number(employee.monthly_hours).toLocaleString("pt-BR")}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <NativeCheckbox name="active" defaultChecked={employee.active} />
        Colaborador ativo
      </label>
      <div>
        <SubmitButton>Salvar dados</SubmitButton>
      </div>
    </form>
  );
}

export function EmployeeAreasForm({
  employeeId,
  areas,
  selected,
}: {
  employeeId: string;
  areas: Pick<Tables<"areas">, "id" | "name" | "active">[];
  selected: string[];
}) {
  const [state, formAction] = useActionState(setEmployeeAreasAction, initialActionState);

  if (!areas.length) {
    return <EmptyState>Cadastre áreas de atuação para vincular.</EmptyState>;
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="employeeId" value={employeeId} />
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

function parsePtBrNumber(val: string): number {
  if (!val) return 0;
  const normalized = val.includes(",") ? val.replace(/\./g, "").replace(",", ".") : val;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function NewCostForm({
  employeeId,
  defaultMonthlyHours,
  today,
}: {
  employeeId: string;
  defaultMonthlyHours: number;
  today: string;
}) {
  const [state, formAction] = useActionState(setEmployeeCostAction, initialActionState);

  // Calcula jornada diária padrão (base: 21 dias úteis)
  const initialDailyHours = defaultMonthlyHours > 0 ? Number((defaultMonthlyHours / 21).toFixed(2)) : 8;

  const [salary, setSalary] = useState<string>("8.000,00");
  const [chargesPercent, setChargesPercent] = useState<string>("80");
  const [chargesAmount, setChargesAmount] = useState<string>("0,00");
  const [benefits, setBenefits] = useState<string>("600,00");
  const [dailyHours, setDailyHours] = useState<string>(
    initialDailyHours.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
  );
  const [workingDays, setWorkingDays] = useState<string>("21");
  const [customMonthlyHours, setCustomMonthlyHours] = useState<string>(
    defaultMonthlyHours.toLocaleString("pt-BR")
  );
  const [mode, setMode] = useState<"diaria" | "mensal">("diaria");

  // Cálculos financeiros e de jornada
  const dailyNum = parsePtBrNumber(dailyHours);
  const daysNum = parsePtBrNumber(workingDays) || 21;
  const calculatedMonthly = mode === "diaria" ? dailyNum * daysNum : parsePtBrNumber(customMonthlyHours);

  const salaryNum = parsePtBrNumber(salary);
  const chargesPctNum = parsePtBrNumber(chargesPercent);
  const chargesValNum = parsePtBrNumber(chargesAmount);
  const benefitsNum = parsePtBrNumber(benefits);

  const chargesFromPct = (salaryNum * chargesPctNum) / 100;
  const totalMonthlyCost = salaryNum + chargesFromPct + chargesValNum + benefitsNum;
  const hourlyCost = calculatedMonthly > 0 ? totalMonthlyCost / calculatedMonthly : 0;
  const dailyCost = daysNum > 0 ? totalMonthlyCost / daysNum : 0;

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input
        type="hidden"
        name="monthlyHours"
        value={calculatedMonthly > 0 ? calculatedMonthly.toFixed(2).replace(".", ",") : "168"}
      />
      <FormAlert state={state} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Salário mensal" htmlFor="monthlySalary" errors={state.fieldErrors?.monthlySalary}>
          <Input
            id="monthlySalary"
            name="monthlySalary"
            inputMode="decimal"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="8.000,00"
            required
          />
        </Field>
        <Field label="Encargos (%)" htmlFor="chargesPercent" errors={state.fieldErrors?.chargesPercent}>
          <Input
            id="chargesPercent"
            name="chargesPercent"
            inputMode="decimal"
            value={chargesPercent}
            onChange={(e) => setChargesPercent(e.target.value)}
            placeholder="80"
          />
        </Field>
        <Field label="Encargos (R$)" htmlFor="chargesAmount" errors={state.fieldErrors?.chargesAmount}>
          <Input
            id="chargesAmount"
            name="chargesAmount"
            inputMode="decimal"
            value={chargesAmount}
            onChange={(e) => setChargesAmount(e.target.value)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Benefícios (R$)" htmlFor="benefits" errors={state.fieldErrors?.benefits}>
          <Input
            id="benefits"
            name="benefits"
            inputMode="decimal"
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            placeholder="600,00"
          />
        </Field>

        {mode === "diaria" ? (
          <>
            <Field
              label="Horas por dia"
              htmlFor="costDailyHours"
              hint={`= ${calculatedMonthly.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h no mês`}
              errors={state.fieldErrors?.monthlyHours}
            >
              <Input
                id="costDailyHours"
                inputMode="decimal"
                value={dailyHours}
                onChange={(e) => setDailyHours(e.target.value)}
                placeholder="8"
                required
              />
            </Field>
            <Field
              label="Dias úteis/mês"
              htmlFor="costWorkingDays"
              hint="Padrão: 21 dias"
            >
              <Input
                id="costWorkingDays"
                inputMode="decimal"
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
                placeholder="21"
                required
              />
            </Field>
          </>
        ) : (
          <Field
            label="Horas no mês"
            htmlFor="costMonthlyHours"
            hint={`≈ ${(parsePtBrNumber(customMonthlyHours) / 21).toFixed(1).replace(".", ",")}h/dia`}
            errors={state.fieldErrors?.monthlyHours}
          >
            <Input
              id="costMonthlyHours"
              inputMode="decimal"
              value={customMonthlyHours}
              onChange={(e) => setCustomMonthlyHours(e.target.value)}
              placeholder="168"
              required
            />
          </Field>
        )}

        <Field label="Vigência a partir de" htmlFor="validFrom" errors={state.fieldErrors?.validFrom}>
          <Input id="validFrom" name="validFrom" type="date" defaultValue={today} required />
        </Field>
      </div>

      {/* Prévia do cálculo em tempo real */}
      <div className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-4 sm:items-center text-sm border">
        <div>
          <span className="text-xs text-muted-foreground block">Custo total mensal</span>
          <strong className="text-base text-foreground font-semibold">{formatCurrency(totalMonthlyCost)}</strong>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">Custo por dia</span>
          <strong className="text-base text-foreground font-semibold">{formatCurrency(dailyCost)}</strong>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">Custo por hora</span>
          <strong className="text-base text-primary font-semibold">{formatCurrency(hourlyCost)}</strong>
        </div>
        <div className="text-xs text-muted-foreground">
          {mode === "diaria" ? (
            <span>
              Cálculo: <strong>{dailyNum.toLocaleString("pt-BR")}h/dia</strong> ×{" "}
              <strong>{daysNum} dias</strong> ={" "}
              <strong>{calculatedMonthly.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h/mês</strong>
            </span>
          ) : (
            <span>
              Jornada: <strong>{calculatedMonthly.toLocaleString("pt-BR")}h no mês</strong> (≈{" "}
              <strong>{(calculatedMonthly / 21).toFixed(1).replace(".", ",")}h/dia</strong>)
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Registrar custo</SubmitButton>
        <button
          type="button"
          onClick={() => setMode(mode === "diaria" ? "mensal" : "diaria")}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === "diaria"
            ? "Prefere informar total de horas no mês diretamente?"
            : "Calcular a partir de horas diárias (jornada)?"}
        </button>
      </div>
    </form>
  );
}

export function CostHistory({
  costs,
  canDelete = false,
}: {
  costs: Tables<"employee_costs">[];
  canDelete?: boolean;
}) {
  if (!costs.length) return <EmptyState>Nenhum custo registrado — a rentabilidade não considerará estas horas.</EmptyState>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vigência</TableHead>
          <TableHead>Salário</TableHead>
          <TableHead>Encargos</TableHead>
          <TableHead>Benefícios</TableHead>
          <TableHead>Jornada / Horas</TableHead>
          <TableHead>Custo hora</TableHead>
          {canDelete ? <TableHead className="w-10 text-right">Ações</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {costs.map((cost) => (
          <TableRow key={cost.id}>
            <TableCell>
              {formatDate(cost.valid_from)} — {cost.valid_to ? formatDate(cost.valid_to) : "vigente"}
            </TableCell>
            <TableCell>{formatCurrency(Number(cost.monthly_salary))}</TableCell>
            <TableCell>
              {Number(cost.charges_percent) > 0 ? `${Number(cost.charges_percent).toLocaleString("pt-BR")}%` : null}
              {Number(cost.charges_percent) > 0 && Number(cost.charges_amount) > 0 ? " + " : null}
              {Number(cost.charges_amount) > 0 ? formatCurrency(Number(cost.charges_amount)) : null}
              {Number(cost.charges_percent) === 0 && Number(cost.charges_amount) === 0 ? "—" : null}
            </TableCell>
            <TableCell>{formatCurrency(Number(cost.benefits))}</TableCell>
            <TableCell>
              <span className="font-medium">
                {(Number(cost.monthly_hours) / 21).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h/dia
              </span>
              <span className="block text-xs text-muted-foreground">{formatHours(Number(cost.monthly_hours))} no mês</span>
            </TableCell>
            <TableCell className="font-medium">{formatCurrency(Number(cost.hourly_cost))}</TableCell>
            {canDelete ? (
              <TableCell className="text-right">
                <DeleteButton
                  action={deleteEmployeeCostAction}
                  hiddenFields={{ id: cost.id, employeeId: cost.employee_id }}
                  title="Excluir vigência de custo"
                  description={`Tem certeza que deseja excluir esta vigência de custo (iniciada em ${formatDate(cost.valid_from)})?`}
                  label="Excluir"
                />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function GrantAccessForm({ employee }: { employee: Tables<"employees"> }) {
  const [state, formAction] = useActionState(grantAccessAction, initialActionState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="employeeId" value={employee.id} />
      <input type="hidden" name="fullName" value={employee.full_name} />
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field label="E-mail de acesso" htmlFor="accessEmail" errors={state.fieldErrors?.email}>
          <Input id="accessEmail" name="email" type="email" defaultValue={employee.email ?? ""} required />
        </Field>
        <Field label="Perfil" htmlFor="accessRole" errors={state.fieldErrors?.role}>
          <NativeSelect id="accessRole" name="role" defaultValue="colaborador">
            <option value="colaborador">Colaborador</option>
            <option value="gestor">Gestor</option>
            <option value="admin">Administrador</option>
          </NativeSelect>
        </Field>
        <SubmitButton>Enviar convite</SubmitButton>
      </div>

      {state.link ? <CopyLink link={state.link} /> : null}
    </form>
  );
}
