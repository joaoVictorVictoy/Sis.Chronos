import { UsersIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { InviteForm } from "./invite-form";
import { MembersTable } from "./members-table";
import { PendingInvitations } from "./pending-invitations";

export const metadata = { title: "Usuários e acessos | Apontamento" };

export default async function UsersPage() {
  const { profile, tenant } = await requireRole(["admin"]);
  const supabase = await createClient();

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("invitations").select("*").is("accepted_at", null).order("created_at", { ascending: false }),
  ]);

  const totalInUse = (members?.length ?? 0) + (invitations?.length ?? 0);
  const maxUsers = tenant.max_users;
  const isLimitReached =
    maxUsers !== null && maxUsers !== undefined && maxUsers > 0 && totalInUse >= maxUsers;

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários e acessos</h1>
        <p className="text-muted-foreground">
          Convide sua equipe e defina o que cada perfil enxerga. Colaboradores nunca veem valores de contrato, custos ou
          salários.
        </p>
      </header>

      {maxUsers ? (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border text-sm ${
            isLimitReached
              ? "border-destructive/30 bg-destructive/5 text-foreground"
              : "border-primary/20 bg-primary/5 text-foreground"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                isLimitReached ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              }`}
            >
              <UsersIcon className="size-5" />
            </div>
            <div>
              <p className="font-semibold">
                {isLimitReached
                  ? "Limite de usuários atingido"
                  : "Controle de Licenças de Usuários"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLimitReached
                  ? `Sua empresa atingiu o teto de ${totalInUse} de ${maxUsers} acessos liberados pelo administrador.`
                  : `Sua empresa está utilizando ${totalInUse} de ${maxUsers} usuários liberados (${maxUsers - totalInUse} vagas disponíveis).`}
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-md self-start sm:self-auto ${
              isLimitReached
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary/15 text-primary"
            }`}
          >
            {totalInUse} / {maxUsers} usuários
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Convidar pessoa</CardTitle>
          <CardDescription>
            Tentamos enviar por e-mail e sempre geramos um link para você copiar — o envio automático do Supabase é
            limitado a poucas mensagens por hora. Quem abrir o link cria a senha e já entra com o perfil escolhido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm isLimitReached={isLimitReached} />
        </CardContent>
      </Card>

      {invitations?.length ? <PendingInvitations invitations={invitations as Tables<"invitations">[]} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>Perfil de acesso, permissão de ver custos individuais e status.</CardDescription>
        </CardHeader>
        <CardContent>
          <MembersTable members={(members ?? []) as Tables<"profiles">[]} currentUserId={profile.id} />
        </CardContent>
      </Card>
    </div>
  );
}
