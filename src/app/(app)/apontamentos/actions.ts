"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext, requireRole } from "@/lib/auth/session";
import { translateError } from "@/lib/auth/errors";
import { parseForm, type ActionState } from "@/lib/actions";
import { periodLockSchema, timeEntrySchema } from "@/lib/validation/schemas";
import { parseDurationToMinutes } from "@/lib/time";

function entryPayload(data: z.output<typeof timeEntrySchema>): { minutes: number } | { error: string } {
  if (data.startTime && data.endTime) {
    const [sh, sm] = data.startTime.split(":").map(Number);
    const [eh, em] = data.endTime.split(":").map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    if (minutes <= 0) return { error: "A hora final precisa ser depois da inicial." };
    return { minutes };
  }
  const minutes = parseDurationToMinutes(data.duration);
  if (minutes === null || minutes <= 0) return { error: "Duração inválida. Use 1:30, 1,5 ou 90m." };
  if (minutes > 1440) return { error: "Duração maior que um dia." };
  return { minutes };
}

export async function createTimeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant, employeeId } = await requireContext();
  if (!employeeId) return { error: "Seu usuário não está vinculado a um colaborador. Fale com o administrador." };

  const parsed = parseForm(timeEntrySchema, formData);
  if (!parsed.ok) return parsed.state;

  const computed = entryPayload(parsed.data);
  if ("error" in computed) return { error: computed.error };

  const supabase = await createClient();

  // Bloqueia colaborador desativado
  const { data: employee } = await supabase.from("employees").select("active").eq("id", employeeId).single();
  if (employee && !employee.active) {
    return { error: "Seu cadastro de colaborador está inativo. Novos apontamentos estão bloqueados." };
  }

  // Vincula automaticamente o contrato ativo do cliente se não tiver sido passado
  let contractId = parsed.data.contractId;
  const clientId = parsed.data.clientId || null;

  if (!contractId && clientId) {
    const { data: activeContract } = await supabase
      .from("contracts")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "ativo")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeContract) {
      contractId = activeContract.id;
    }
  }

  // Bloqueia cliente inativo
  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("active, legal_name, trade_name")
      .eq("id", clientId)
      .single();
    if (client && !client.active) {
      return {
        error: `O cliente "${client.trade_name || client.legal_name}" está inativo. Novos apontamentos estão bloqueados.`,
      };
    }
  }

  // Bloqueia contrato encerrado ou apontamentos além da data de corte
  if (contractId) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("name, status, end_date, terminated_at")
      .eq("id", contractId)
      .single();

    if (contract && contract.status === "encerrado") {
      const cutOff = contract.terminated_at || contract.end_date;
      if (cutOff && parsed.data.entryDate > cutOff) {
        return {
          error: `O contrato "${contract.name}" foi encerrado em ${cutOff}. Apontamentos após essa data estão bloqueados.`,
        };
      }
      return {
        error: `O contrato "${contract.name}" está encerrado. Novos apontamentos estão bloqueados.`,
      };
    }
  }

  const { error } = await supabase.from("time_entries").insert({
    tenant_id: tenant.id,
    employee_id: employeeId,
    client_id: clientId,
    contract_id: contractId,
    activity_id: parsed.data.activityId,
    entry_date: parsed.data.entryDate,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    minutes: computed.minutes,
    description: parsed.data.description,
  });
  if (error) return { error: translateError(error) };

  revalidatePath("/apontamentos");
  revalidatePath("/dashboard");

  const entryEndMs = new Date(`${parsed.data.entryDate}T${parsed.data.endTime || "23:59:59"}`).getTime();
  const isWithin24h = Date.now() <= entryEndMs + 24 * 60 * 60 * 1000;

  return {
    success: isWithin24h
      ? "Apontamento registrado e aprovado automaticamente (dentro do prazo de 24h)."
      : "Apontamento registrado (aguardando aprovação do gestor).",
  };
}

export async function updateTimeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireContext();
  const parsed = parseForm(timeEntrySchema.safeExtend({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const computed = entryPayload(parsed.data);
  if ("error" in computed) return { error: computed.error };

  const supabase = await createClient();

  let contractId = parsed.data.contractId;
  const clientId = parsed.data.clientId || null;

  if (!contractId && clientId) {
    const { data: activeContract } = await supabase
      .from("contracts")
      .select("id")
      .eq("client_id", clientId)
      .eq("status", "ativo")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeContract) {
      contractId = activeContract.id;
    }
  }

  // Bloqueia cliente inativo
  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("active, legal_name, trade_name")
      .eq("id", clientId)
      .single();
    if (client && !client.active) {
      return {
        error: `O cliente "${client.trade_name || client.legal_name}" está inativo. Edição para este cliente está bloqueada.`,
      };
    }
  }

  // Bloqueia contrato encerrado ou apontamentos além da data de corte
  if (contractId) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("name, status, end_date, terminated_at")
      .eq("id", contractId)
      .single();

    if (contract && contract.status === "encerrado") {
      const cutOff = contract.terminated_at || contract.end_date;
      if (cutOff && parsed.data.entryDate > cutOff) {
        return {
          error: `O contrato "${contract.name}" foi encerrado em ${cutOff}. Apontamentos após essa data estão bloqueados.`,
        };
      }
      return {
        error: `O contrato "${contract.name}" está encerrado. Novos apontamentos estão bloqueados.`,
      };
    }
  }

  const { data: updatedEntry, error } = await supabase
    .from("time_entries")
    .update({
      client_id: clientId,
      contract_id: contractId,
      activity_id: parsed.data.activityId,
      entry_date: parsed.data.entryDate,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      minutes: computed.minutes,
      description: parsed.data.description,
    })
    .eq("id", parsed.data.id)
    .select("status")
    .maybeSingle();

  if (error) return { error: translateError(error) };

  revalidatePath("/apontamentos");
  revalidatePath("/aprovacoes");
  revalidatePath("/dashboard");

  if (updatedEntry?.status === "pendente") {
    return { success: "Apontamento corrigido e reenviado para aprovação da gestão." };
  }

  return { success: "Apontamento atualizado com sucesso." };
}

export async function deleteTimeEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireContext();
  const parsed = parseForm(z.object({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", parsed.data.id);
  if (error) return { error: translateError(error) };

  revalidatePath("/apontamentos");
  revalidatePath("/aprovacoes");
  revalidatePath("/dashboard");
  return { success: "Apontamento excluído." };
}

export async function requestTimeEntryDeletionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireContext();
  const parsed = parseForm(
    z.object({
      id: z.uuid(),
      reason: z
        .string()
        .trim()
        .min(3, "Informe uma justificativa para a exclusão (mínimo 3 caracteres).")
        .max(500, "A justificativa deve ter no máximo 500 caracteres."),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_time_entry_deletion", {
    p_id: parsed.data.id,
    p_reason: parsed.data.reason,
  });

  if (error) return { error: translateError(error) };

  revalidatePath("/apontamentos");
  revalidatePath("/aprovacoes");
  return { success: "Solicitação de exclusão enviada com sucesso para aprovação do gestor." };
}

export async function cancelTimeEntryDeletionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireContext();
  const parsed = parseForm(z.object({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_time_entry_deletion", {
    p_id: parsed.data.id,
  });

  if (error) return { error: translateError(error) };

  revalidatePath("/apontamentos");
  revalidatePath("/aprovacoes");
  return { success: "Solicitação de exclusão cancelada." };
}

export async function reviewDeletionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const ids = formData.getAll("ids").filter((v): v is string => typeof v === "string");
  const action = formData.get("action");
  const comment = formData.get("comment");

  const parsed = z
    .object({
      ids: z.array(z.uuid()).min(1, "Selecione ao menos um apontamento."),
      action: z.enum(["aprovar", "rejeitar"]),
      comment: z
        .string()
        .trim()
        .max(500)
        .transform((v) => (v === "" ? null : v))
        .optional(),
    })
    .safeParse({ ids, action, comment: typeof comment === "string" ? comment : null });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_time_entry_deletion", {
    p_ids: parsed.data.ids,
    p_action: parsed.data.action,
    p_comment: parsed.data.comment ?? null,
  });

  if (error) return { error: translateError(error) };

  revalidatePath("/aprovacoes");
  revalidatePath("/apontamentos");
  revalidatePath("/dashboard");

  if (parsed.data.action === "aprovar") {
    return { success: `${data ?? 0} apontamento(s) excluído(s) com sucesso.` };
  }
  return { success: `${data ?? 0} solicitação(ões) de exclusão rejeitada(s).` };
}

export async function reviewTimeEntriesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const ids = formData.getAll("ids").filter((v): v is string => typeof v === "string");
  const status = formData.get("status");
  const comment = formData.get("comment");

  const parsed = z
    .object({
      ids: z.array(z.uuid()).min(1, "Selecione ao menos um apontamento."),
      status: z.enum(["aprovado", "rejeitado"]),
      comment: z
        .string()
        .trim()
        .max(500)
        .transform((v) => (v === "" ? null : v)),
    })
    .safeParse({ ids, status, comment: typeof comment === "string" ? comment : "" });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_time_entries", {
    p_ids: parsed.data.ids,
    p_status: parsed.data.status,
    p_comment: parsed.data.comment,
  });
  if (error) return { error: translateError(error) };

  revalidatePath("/aprovacoes");
  revalidatePath("/apontamentos");
  return {
    success: `${data} apontamento(s) ${parsed.data.status === "aprovado" ? "aprovado(s)" : "rejeitado(s)"}.`,
  };
}

export async function setPeriodLockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = parseForm(periodLockSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_period_lock", { p_locked_through: parsed.data.lockedThrough });
  if (error) return { error: translateError(error) };

  revalidatePath("/", "layout");
  return {
    success: parsed.data.lockedThrough
      ? "Período fechado. Lançamentos até essa data ficam bloqueados."
      : "Bloqueio removido.",
  };
}
