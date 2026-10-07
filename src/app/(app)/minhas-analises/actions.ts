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
  targetEmployeeId?: string;
}) {
  const { tenant, employeeId, profile } = await requireContext();
  const isManager = profile.role === "admin" || profile.role === "gestor";

  // Se for especificado um colaborador alvo diferente do usuário logado, exige gestor/admin
  const finalEmployeeId = data.targetEmployeeId || employeeId;

  if (!finalEmployeeId) {
    return { error: "Colaborador não identificado." };
  }

  if (data.targetEmployeeId && data.targetEmployeeId !== employeeId && !isManager) {
    return { error: "Apenas gestores ou administradores podem cadastrar férias para outros colaboradores." };
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
    employee_id: finalEmployeeId,
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
  revalidatePath("/inicio");
  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${finalEmployeeId}`);
  return { success: true };
}

export async function updateEmployeeLeaveAction(data: {
  leaveId: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  notes?: string;
}) {
  const { tenant, employeeId, profile } = await requireContext();
  const isManager = profile.role === "admin" || profile.role === "gestor";

  const startDate = data.startDate.trim();
  const endDate = data.endDate.trim();

  if (!startDate || !endDate) {
    return { error: "Informe as datas de início e término." };
  }

  if (startDate > endDate) {
    return { error: "A data inicial não pode ser posterior à data final." };
  }

  const supabase = await createClient();

  // Verifica o registro antes de atualizar
  const { data: existingLeave } = await supabase
    .from("employee_leaves")
    .select("employee_id")
    .eq("id", data.leaveId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!existingLeave) {
    return { error: "Registro de férias não encontrado." };
  }

  if (!isManager && existingLeave.employee_id !== employeeId) {
    return { error: "Você não tem permissão para alterar este registro." };
  }

  const { error } = await supabase
    .from("employee_leaves")
    .update({
      start_date: startDate,
      end_date: endDate,
      type: data.type,
      notes: data.notes?.trim() || null,
    })
    .eq("id", data.leaveId)
    .eq("tenant_id", tenant.id);

  if (error) {
    console.error("Erro ao atualizar férias/recesso:", error);
    return { error: "Não foi possível atualizar o período." };
  }

  revalidatePath("/minhas-analises");
  revalidatePath("/apontamentos");
  revalidatePath("/inicio");
  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${existingLeave.employee_id}`);
  return { success: true };
}

export async function deleteEmployeeLeaveAction(leaveId: string) {
  const { tenant, employeeId, profile } = await requireContext();
  const isManager = profile.role === "admin" || profile.role === "gestor";

  const supabase = await createClient();

  // Busca para validar permissão e revalidar o colaborador correto
  const { data: existingLeave } = await supabase
    .from("employee_leaves")
    .select("employee_id")
    .eq("id", leaveId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!existingLeave) {
    return { error: "Registro não encontrado." };
  }

  if (!isManager && existingLeave.employee_id !== employeeId) {
    return { error: "Você não tem permissão para remover este registro." };
  }

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
  revalidatePath("/inicio");
  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${existingLeave.employee_id}`);
  return { success: true };
}
