import Link from "next/link";
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
          className={`flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg border text-xs ${
            isLimitReached
              ? "border-destructive/30 bg-destructive/10 text-foreground"
              : "border-border/60 bg-muted/40 text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <UsersIcon
              className={`size-3.5 shrink-0 ${
                isLimitReached ? "text-destructive" : "text-primary"
              }`}
            />
            <span className="truncate">
              {isLimitReached ? (
                <>
                  <strong className="text-destructive font-semibold">Limite de usuários atingido:</strong>{" "}
                  {totalInUse} de {maxUsers} acessos em uso. Contrate um plano superior para cadastrar mais membros.
                </>
              ) : (
                <>
                  <strong className="text-foreground font-medium">Licenças de usuários:</strong>{" "}
                  {totalInUse} de {maxUsers} em uso ({maxUsers - totalInUse} vagas disponíveis).
                </>
              )}
            </span>
          </div>

          {isLimitReached ? (
            <Link
              href="/configuracoes/assinatura"
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0 inline-flex items-center gap-1 shadow-xs"
            >
              Plano superior &rarr;
            </Link>
          ) : (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary shrink-0">
              {totalInUse} / {maxUsers} usuários
            </span>
          )}
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
