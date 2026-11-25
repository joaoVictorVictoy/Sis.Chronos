"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/subscription/status";
import { translateError } from "@/lib/auth/errors";
import { parseForm, type ActionState } from "@/lib/actions";
import { loginSchema } from "@/lib/validation/schemas";

async function checkIsSuperAdmin(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (isSuperAdminEmail(email)) return true;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("super_admins")
      .select("id")
      .ilike("email", email.trim())
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function superAdminLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = (formData.get("email") as string)?.trim() || "";
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.ok) return { ...parsed.state, email };

  // 1. Pré-validação rápida do e-mail (env, defaults ou tabela super_admins)
  if (!(await checkIsSuperAdmin(parsed.data.email))) {
    return {
      error: "Acesso restrito: este e-mail não possui permissão de Super Admin do sistema.",
      email,
    };
  }

  // 2. Autenticação no Supabase
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: translateError(error), email };
  }

  // 3. Validação do usuário autenticado
  if (!(await checkIsSuperAdmin(data.user?.email))) {
    await supabase.auth.signOut();
    return {
      error: "Acesso restrito: este usuário não possui perfil de Super Admin.",
      email,
    };
  }

  revalidatePath("/", "layout");
  redirect("/super-admin");
}
