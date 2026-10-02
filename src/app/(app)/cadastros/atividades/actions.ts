"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { translateError } from "@/lib/auth/errors";
import { parseForm, type ActionState } from "@/lib/actions";
import { activitySchema } from "@/lib/validation/schemas";

export async function createActivityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireRole(["admin", "gestor"]);
  const parsed = parseForm(activitySchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    tenant_id: tenant.id,
    name: parsed.data.name,
    area_id: parsed.data.areaId,
    billable: parsed.data.billable,
    active: true,
  });
  if (error) {
    if (error.code === "23505") return { error: "Já existe uma atividade com esse nome." };
    return { error: translateError(error) };
  }

  revalidatePath("/cadastros/atividades");
  return { success: "Atividade criada." };
}

export async function updateActivityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const parsed = parseForm(activitySchema.extend({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .update({
      name: parsed.data.name,
      area_id: parsed.data.areaId,
      billable: parsed.data.billable,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.id);
  if (error) {
    if (error.code === "23505") return { error: "Já existe uma atividade com esse nome." };
    return { error: translateError(error) };
  }

  revalidatePath("/cadastros/atividades");
  return { success: "Atividade atualizada." };
}

export async function deleteActivityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const parsed = parseForm(z.object({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();

  // Verifica se há apontamentos nesta atividade
  const { count } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("activity_id", parsed.data.id);

  // Se tiver histórico de apontamentos, realiza soft delete
  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("activities")
      .update({ active: false, is_active: false })
      .eq("id", parsed.data.id);
    if (error) return { error: translateError(error) };

    revalidatePath("/cadastros/atividades");
    return { success: "Atividade possui histórico de apontamentos e foi desativada para preservar relatórios." };
  }

  // Sem histórico: tenta exclusão física
  const { error } = await supabase.from("activities").delete().eq("id", parsed.data.id);
  if (error) {
    // Se falhar por restrição de FK (ex: contract_activities), desativa
    await supabase.from("activities").update({ active: false, is_active: false }).eq("id", parsed.data.id);
    revalidatePath("/cadastros/atividades");
    return { success: "Atividade desativada para preservar a integridade dos vínculos existentes." };
  }

  revalidatePath("/cadastros/atividades");
  return { success: "Atividade excluída." };
}
