"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { translateError } from "@/lib/auth/errors";
import { parseForm, type ActionState } from "@/lib/actions";
import { areaSchema } from "@/lib/validation/schemas";

export async function createAreaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireRole(["admin", "gestor"]);
  const parsed = parseForm(areaSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.from("areas").insert({
    tenant_id: tenant.id,
    name: parsed.data.name,
    description: parsed.data.description,
    active: true,
  });
  if (error) {
    if (error.code === "23505") return { error: "Já existe uma área com esse nome." };
    return { error: translateError(error) };
  }

  revalidatePath("/cadastros/areas");
  return { success: "Área criada." };
}

export async function updateAreaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const parsed = parseForm(areaSchema.extend({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("areas")
    .update({ name: parsed.data.name, description: parsed.data.description, active: parsed.data.active })
    .eq("id", parsed.data.id);
  if (error) {
    if (error.code === "23505") return { error: "Já existe uma área com esse nome." };
    return { error: translateError(error) };
  }

  revalidatePath("/cadastros/areas");
  return { success: "Área atualizada." };
}

export async function deleteAreaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const parsed = parseForm(z.object({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();

  // Verifica se há atividades desta área com apontamentos
  const { data: areaActivities } = await supabase
    .from("activities")
    .select("id")
    .eq("area_id", parsed.data.id);

  const activityIds = (areaActivities ?? []).map((a) => a.id);
  let hasLinkedEntries = false;
  if (activityIds.length > 0) {
    const { count } = await supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .in("activity_id", activityIds);
    hasLinkedEntries = (count ?? 0) > 0;
  }

  // Se tiver histórico de apontamentos, desativa a área (soft delete)
  if (hasLinkedEntries) {
    const { error } = await supabase
      .from("areas")
      .update({ active: false, is_active: false })
      .eq("id", parsed.data.id);
    if (error) return { error: translateError(error) };

    revalidatePath("/cadastros/areas");
    return { success: "Área possui histórico de apontamentos e foi desativada para preservar relatórios." };
  }

  // Sem histórico de apontamentos: tenta exclusão física
  const { error } = await supabase.from("areas").delete().eq("id", parsed.data.id);
  if (error) {
    // Se falhar por restrição de FK (ex: vínculos com atividades ainda não apontadas), desativa
    await supabase.from("areas").update({ active: false, is_active: false }).eq("id", parsed.data.id);
    revalidatePath("/cadastros/areas");
    return { success: "Área desativada para preservar integridade dos vínculos existentes." };
  }

  revalidatePath("/cadastros/areas");
  return { success: "Área excluída." };
}
