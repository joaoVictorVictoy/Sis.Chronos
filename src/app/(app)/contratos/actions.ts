"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { translateError } from "@/lib/auth/errors";
import { parseForm, type ActionState } from "@/lib/actions";
import { contractSchema, expenseSchema, reopenContractSchema, terminateContractSchema } from "@/lib/validation/schemas";

function contractPayload(data: z.output<typeof contractSchema>) {
  return {
    name: data.name,
    description: data.description,
    amount: data.amount,
    periodicity: data.periodicity,
    start_date: data.startDate,
    end_date: data.endDate,
    desired_margin: data.desiredMargin,
    tax_rate: data.taxRate,
    expected_hours: data.expectedHours,
    status: data.status,
  };
}

export async function createContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireRole(["admin"]);
  const parsed = parseForm(contractSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .insert({ tenant_id: tenant.id, client_id: parsed.data.clientId, ...contractPayload(parsed.data) })
    .select("id")
    .single();

  if (error) return { error: translateError(error) };

  revalidatePath(`/clientes/${parsed.data.clientId}`);
  redirect(`/contratos/${data.id}`);
}

export async function updateContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = parseForm(contractSchema.safeExtend({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.from("contracts").update(contractPayload(parsed.data)).eq("id", parsed.data.id);
  if (error) return { error: translateError(error) };

  revalidatePath(`/contratos/${parsed.data.id}`);
  revalidatePath(`/clientes/${parsed.data.clientId}`);
  return { success: "Contrato salvo." };
}

/** Áreas, atividades e colaboradores alocados. */
export async function setContractLinksAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireRole(["admin"]);
  const contractId = z.uuid().safeParse(formData.get("contractId"));
  if (!contractId.success) return { error: "Contrato inválido." };

  const ids = (name: string) => formData.getAll(name).filter((v): v is string => typeof v === "string");
  const areaIds = ids("areaIds");
  const activityIds = ids("activityIds");
  const employeeIds = ids("employeeIds");

  const supabase = await createClient();
  const contract = contractId.data;

  const [a, b, c] = await Promise.all([
    supabase.from("contract_areas").delete().eq("contract_id", contract),
    supabase.from("contract_activities").delete().eq("contract_id", contract),
    supabase.from("contract_members").delete().eq("contract_id", contract),
  ]);
  const delError = a.error ?? b.error ?? c.error;
  if (delError) return { error: translateError(delError) };

  const inserts = await Promise.all([
    areaIds.length
      ? supabase
          .from("contract_areas")
          .insert(areaIds.map((area_id) => ({ tenant_id: tenant.id, contract_id: contract, area_id })))
      : Promise.resolve({ error: null }),
    activityIds.length
      ? supabase
          .from("contract_activities")
          .insert(activityIds.map((activity_id) => ({ tenant_id: tenant.id, contract_id: contract, activity_id })))
      : Promise.resolve({ error: null }),
    employeeIds.length
      ? supabase
          .from("contract_members")
          .insert(employeeIds.map((employee_id) => ({ tenant_id: tenant.id, contract_id: contract, employee_id })))
      : Promise.resolve({ error: null }),
  ]);
  const insError = inserts.find((r) => r.error)?.error;
  if (insError) return { error: translateError(insError) };

  revalidatePath(`/contratos/${contract}`);
  return { success: "Vínculos atualizados." };
}

export async function createExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireRole(["admin"]);
  const parsed = parseForm(expenseSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.from("contract_expenses").insert({
    tenant_id: tenant.id,
    contract_id: parsed.data.contractId,
    description: parsed.data.description,
    category: parsed.data.category,
    amount: parsed.data.amount,
    expense_date: parsed.data.expenseDate,
    recurrence: parsed.data.recurrence,
    end_date: parsed.data.endDate,
  });
  if (error) return { error: translateError(error) };

  revalidatePath(`/contratos/${parsed.data.contractId}`);
  return { success: "Gasto adicionado." };
}

export async function deleteExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = parseForm(z.object({ id: z.uuid(), contractId: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.from("contract_expenses").delete().eq("id", parsed.data.id);
  if (error) return { error: translateError(error) };

  revalidatePath(`/contratos/${parsed.data.contractId}`);
  return { success: "Gasto removido." };
}

export async function terminateContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const terminateAllClientContracts = formData.get("terminateAllClientContracts") === "true";
  const parsed = parseForm(terminateContractSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();

  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select("id, client_id, name")
    .eq("id", parsed.data.contractId)
    .single();

  if (contractErr || !contract) return { error: "Contrato não encontrado." };

  const terminationPayload = {
    status: "encerrado" as const,
    termination_reason: parsed.data.terminationReason,
    termination_sub_reason: parsed.data.terminationSubReason || null,
    termination_notes: parsed.data.terminationNotes || null,
    terminated_at: parsed.data.terminatedAt,
    termination_penalty: parsed.data.terminationPenalty ?? null,
    end_date: parsed.data.terminatedAt,
  };

  const { error: updateErr } = terminateAllClientContracts
    ? await supabase
        .from("contracts")
        .update(terminationPayload)
        .eq("client_id", contract.client_id)
        .eq("status", "ativo")
    : await supabase
        .from("contracts")
        .update(terminationPayload)
        .eq("id", contract.id);

  if (updateErr) return { error: translateError(updateErr) };

  // Se solicitado desativar o cliente, verifica se não há outros contratos ativos
  if (parsed.data.deactivateClient || terminateAllClientContracts) {
    const { count } = await supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", contract.client_id)
      .eq("status", "ativo")
      .neq("id", contract.id);

    if (count === 0 || terminateAllClientContracts) {
      await supabase
        .from("clients")
        .update({ active: false, is_active: false })
        .eq("id", contract.client_id);
    }
  }

  revalidatePath(`/contratos/${contract.id}`);
  revalidatePath(`/clientes/${contract.client_id}`);
  revalidatePath("/clientes");
  revalidatePath("/apontamentos");
  revalidatePath("/dashboard");

  return { success: "Contrato encerrado com sucesso." };
}

export async function reopenContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = parseForm(reopenContractSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();

  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select("id, client_id")
    .eq("id", parsed.data.contractId)
    .single();

  if (contractErr || !contract) return { error: "Contrato não encontrado." };

  const { error: updateErr } = await supabase
    .from("contracts")
    .update({
      status: "ativo",
      termination_reason: null,
      termination_sub_reason: null,
      termination_notes: null,
      terminated_at: null,
      termination_penalty: null,
    })
    .eq("id", contract.id);

  if (updateErr) return { error: translateError(updateErr) };

  // Reativa o cliente
  await supabase.from("clients").update({ active: true, is_active: true }).eq("id", contract.client_id);

  revalidatePath(`/contratos/${contract.id}`);
  revalidatePath(`/clientes/${contract.client_id}`);
  revalidatePath("/clientes");
  revalidatePath("/apontamentos");
  revalidatePath("/dashboard");

  return { success: "Contrato reaberto como ativo." };
}

export async function deleteContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const parsed = parseForm(z.object({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();

  // 1. Busca o contrato e seu cliente
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select("id, client_id, name")
    .eq("id", parsed.data.id)
    .single();

  if (contractErr || !contract) return { error: "Contrato não encontrado." };

  // 2. Verifica se há apontamentos vinculados a este contrato
  const { count: entriesCount } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contract.id);

  if ((entriesCount ?? 0) > 0) {
    return {
      error: `Não é possível excluir o contrato "${contract.name}" pois existem ${entriesCount} apontamento(s) de horas vinculado(s) a ele. Caso tenha sido lançado por engano, exclua ou realoque os apontamentos antes, ou encerre o contrato.`,
    };
  }

  // 3. Remove vínculos dependentes e gastos extras associados
  await Promise.all([
    supabase.from("contract_areas").delete().eq("contract_id", contract.id),
    supabase.from("contract_activities").delete().eq("contract_id", contract.id),
    supabase.from("contract_members").delete().eq("contract_id", contract.id),
    supabase.from("contract_expenses").delete().eq("contract_id", contract.id),
  ]);

  // 4. Exclui o contrato
  const { error: delErr } = await supabase.from("contracts").delete().eq("id", contract.id);
  if (delErr) return { error: translateError(delErr) };

  revalidatePath(`/clientes/${contract.client_id}`);
  revalidatePath("/clientes");
  revalidatePath("/apontamentos");
  revalidatePath("/dashboard");

  const shouldRedirect = formData.get("redirectToClient") === "true";
  if (shouldRedirect) {
    redirect(`/clientes/${contract.client_id}`);
  }

  return { success: `Contrato "${contract.name}" excluído com sucesso.` };
}

