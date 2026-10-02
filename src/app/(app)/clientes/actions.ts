"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { translateError } from "@/lib/auth/errors";
import { parseForm, type ActionState } from "@/lib/actions";
import { clientSchema } from "@/lib/validation/schemas";

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireRole(["admin", "gestor"]);
  const parsed = parseForm(clientSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: tenant.id,
      legal_name: parsed.data.legalName,
      trade_name: parsed.data.tradeName,
      cnpj: parsed.data.cnpj,
      contact_name: parsed.data.contactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Já existe um cliente com essa razão social." };
    return { error: translateError(error) };
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function updateClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const parsed = parseForm(clientSchema.extend({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      legal_name: parsed.data.legalName,
      trade_name: parsed.data.tradeName,
      cnpj: parsed.data.cnpj,
      contact_name: parsed.data.contactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.id);

  if (error) {
    if (error.code === "23505") return { error: "Já existe um cliente com essa razão social." };
    return { error: translateError(error) };
  }

  revalidatePath(`/clientes/${parsed.data.id}`);
  revalidatePath("/clientes");
  return { success: "Cliente atualizado." };
}

export async function setClientAreasAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireRole(["admin", "gestor"]);
  const clientId = z.uuid().safeParse(formData.get("clientId"));
  if (!clientId.success) return { error: "Cliente inválido." };

  const areaIds = formData.getAll("areaIds").filter((v): v is string => typeof v === "string");

  const supabase = await createClient();
  const { error: delError } = await supabase.from("client_areas").delete().eq("client_id", clientId.data);
  if (delError) return { error: translateError(delError) };

  if (areaIds.length) {
    const { error } = await supabase
      .from("client_areas")
      .insert(areaIds.map((areaId) => ({ tenant_id: tenant.id, client_id: clientId.data, area_id: areaId })));
    if (error) return { error: translateError(error) };
  }

  revalidatePath(`/clientes/${clientId.data}`);
  return { success: "Áreas atualizadas." };
}

export async function deleteClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin", "gestor"]);
  const parsed = parseForm(z.object({ id: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();

  // Verifica se há apontamentos vinculados diretamente ao cliente
  const { count: directCount } = await supabase
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("client_id", parsed.data.id);

  // Verifica se há contratos com apontamentos
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id")
    .eq("client_id", parsed.data.id);

  let hasLinkedEntries = (directCount ?? 0) > 0;
  if (!hasLinkedEntries && contracts && contracts.length > 0) {
    const contractIds = contracts.map((c) => c.id);
    const { count: contractEntries } = await supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .in("contract_id", contractIds);
    if ((contractEntries ?? 0) > 0) hasLinkedEntries = true;
  }

  // Se tiver histórico de apontamentos, faz soft delete para não quebrar relatórios passados
  if (hasLinkedEntries) {
    const { error } = await supabase
      .from("clients")
      .update({ active: false, is_active: false })
      .eq("id", parsed.data.id);
    if (error) return { error: translateError(error) };

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${parsed.data.id}`);
    return { success: "Cliente possui histórico de apontamentos e foi desativado para preservar relatórios." };
  }

  // Se não tiver apontamentos, tenta exclusão física
  const { error } = await supabase.from("clients").delete().eq("id", parsed.data.id);
  if (error) {
    // Se ainda houver restrição de integridade (ex: contratos vazios), desativa
    await supabase.from("clients").update({ active: false, is_active: false }).eq("id", parsed.data.id);
    revalidatePath("/clientes");
    return { success: "Cliente desativado para preservar a integridade dos dados." };
  }

  revalidatePath("/clientes");
  return { success: "Cliente excluído." };
}
