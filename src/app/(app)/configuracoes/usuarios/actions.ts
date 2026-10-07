"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/session";
import { translateError } from "@/lib/auth/errors";
import { createAccessLink } from "@/lib/server/access-link";
import { getOrigin } from "@/lib/server/origin";
import { parseForm, type ActionState } from "@/lib/actions";
import { inviteSchema, updateMemberSchema } from "@/lib/validation/schemas";

export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { tenant } = await requireRole(["admin"]);
  const parsed = parseForm(inviteSchema, formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  // O RLS garante que só admin da própria empresa consegue inserir.
  const { error } = await supabase.from("invitations").insert({
    tenant_id: tenant.id,
    email: parsed.data.email,
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    can_view_costs: parsed.data.role === "gestor" && parsed.data.canViewCosts,
  });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um convite pendente para este e-mail." };
    return { error: translateError(error) };
  }

  revalidatePath("/configuracoes/usuarios");

  // Tenta o e-mail automático, mas nunca depende dele: o envio nativo do
  // Supabase é limitado a poucas mensagens por hora e costuma falhar em
  // produção. O link copiável abaixo é o caminho garantido.
  let emailEnviado = false;
  try {
    const admin = createAdminClient();
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email);
    emailEnviado = !inviteError;
  } catch {
    emailEnviado = false;
  }

  const origin = await getOrigin();
  const gerado = await createAccessLink(parsed.data.email, origin);

  if ("error" in gerado) {
    return {
      success: emailEnviado
        ? `Convite enviado por e-mail para ${parsed.data.email}.`
        : `Convite registrado para ${parsed.data.email}, mas não foi possível enviar o e-mail nem gerar o link (${gerado.error}).`,
    };
  }

  return {
    success: emailEnviado
      ? `Convite enviado para ${parsed.data.email}. Se o e-mail não chegar, use o link abaixo.`
      : `Convite criado para ${parsed.data.email}. O e-mail automático não saiu — envie o link abaixo.`,
    link: gerado.link,
  };
}

/** Gera de novo o link de acesso de um convite pendente. */
export async function accessLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = parseForm(z.object({ email: z.email() }), formData);
  if (!parsed.ok) return parsed.state;

  const origin = await getOrigin();
  const gerado = await createAccessLink(parsed.data.email, origin);
  if ("error" in gerado) return { error: gerado.error };

  return { success: `Link de acesso para ${parsed.data.email}:`, link: gerado.link };
}

export async function cancelInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["admin"]);
  const parsed = parseForm(z.object({ invitationId: z.uuid() }), formData);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", parsed.data.invitationId);
  if (error) return { error: translateError(error) };

  revalidatePath("/configuracoes/usuarios");
  return { success: "Convite cancelado." };
}

export async function updateMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireRole(["admin"]);
  const parsed = parseForm(updateMemberSchema, formData);
  if (!parsed.ok) return parsed.state;

  const canViewCosts = parsed.data.role === "gestor" ? Boolean(parsed.data.canViewCosts) : false;
  const active = Boolean(parsed.data.active);

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    adminClient = null;
  }

  const client = adminClient ?? (await createClient());

  // 1. Valida se o membro pertence à mesma empresa
  const { data: targetMember, error: fetchError } = await client
    .from("profiles")
    .select("id, role, active, tenant_id")
    .eq("id", parsed.data.profileId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (fetchError || !targetMember) {
    return { error: "Membro não encontrado na sua empresa." };
  }

  // 2. Proteção: a empresa precisa de pelo menos 1 admin ativo
  if (
    targetMember.role === "admin" &&
    targetMember.active &&
    (parsed.data.role !== "admin" || !active)
  ) {
    const { count, error: countError } = await client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "admin")
      .eq("active", true);

    if (!countError && (count ?? 0) <= 1) {
      return { error: "A empresa precisa de pelo menos um administrador ativo." };
    }
  }

  // 3. Executa a atualização
  const { error: updateError } = await client
    .from("profiles")
    .update({
      role: parsed.data.role,
      can_view_costs: canViewCosts,
      active: active,
    })
    .eq("id", parsed.data.profileId)
    .eq("tenant_id", profile.tenant_id);

  if (updateError) {
    return { error: translateError(updateError) };
  }

  // Sincroniza status ativo na tabela de colaboradores se existir vínculo
  await client
    .from("employees")
    .update({ active: active })
    .eq("profile_id", parsed.data.profileId)
    .eq("tenant_id", profile.tenant_id);

  revalidatePath("/configuracoes/usuarios");
  revalidatePath("/", "layout");
  return { success: "Acesso atualizado com sucesso." };
}
