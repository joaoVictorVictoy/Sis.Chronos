"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type LeaveType = "ferias" | "recesso" | "folga" | "outro";

export async function createEmployeeLeaveAction(data: {
  startDate: string;
  endDate: string;
  type: LeaveType;
  notes?: string;
}) {
  const { tenant, employeeId } = await requireContext();

  if (!employeeId) {
    return { error: "Seu usuário não possui um colaborador vinculado." };
  }

  const startDate = data.startDate.trim();
  const endDate = data.endDate.trim();

  if (!startDate || !endDate) {
    return { error: "Informe as datas de início e término." };
  }

  if (startDate > endDate) {
    return { error: "A data inicial não pode ser posterior à data final." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("employee_leaves").insert({
    tenant_id: tenant.id,
    employee_id: employeeId,
    start_date: startDate,
    end_date: endDate,
    type: data.type,
    notes: data.notes?.trim() || null,
  });

  if (error) {
    console.error("Erro ao cadastrar férias/recesso:", error);
    return { error: "Não foi possível registrar o período. Tente novamente." };
  }

  revalidatePath("/minhas-analises");
  revalidatePath("/apontamentos");
  return { success: true };
}

export async function deleteEmployeeLeaveAction(leaveId: string) {
  const { tenant, employeeId } = await requireContext();

  if (!employeeId) {
    return { error: "Seu usuário não possui um colaborador vinculado." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("employee_leaves")
    .delete()
    .eq("id", leaveId)
    .eq("tenant_id", tenant.id);

  if (error) {
    console.error("Erro ao excluir férias/recesso:", error);
    return { error: "Não foi possível remover o registro." };
  }

  revalidatePath("/minhas-analises");
  revalidatePath("/apontamentos");
  return { success: true };
}
