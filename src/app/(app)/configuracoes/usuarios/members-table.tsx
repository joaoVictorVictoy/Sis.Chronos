"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LinkIcon } from "lucide-react";
import { NativeCheckbox, NativeSelect } from "@/components/native-select";
import { CopyLink } from "@/components/copy-link";
import { FormAlert, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { AppRole, Tables } from "@/lib/database.types";
import { accessLinkAction, updateMemberAction } from "./actions";

function MemberRow({ member, isCurrentUser }: { member: Tables<"profiles">; isCurrentUser: boolean }) {
  const [state, formAction] = useActionState(updateMemberAction, initialActionState);
  const [linkState, linkAction] = useActionState(accessLinkAction, initialActionState);
  const [role, setRole] = useState<AppRole>(member.role);
  const [canViewCosts, setCanViewCosts] = useState<boolean>(member.can_view_costs);
  const [active, setActive] = useState<boolean>(member.active);

  const hasChanges =
    role !== member.role ||
    canViewCosts !== member.can_view_costs ||
    active !== member.active;

  useEffect(() => {
    setRole(member.role);
    setCanViewCosts(member.can_view_costs);
    setActive(member.active);
  }, [member.role, member.can_view_costs, member.active]);

  return (
    <TableRow>
      <TableCell className="align-top whitespace-normal">
        <div className="grid">
          <span className="font-medium">
            {member.full_name}
            {isCurrentUser ? <span className="ml-1 text-xs text-muted-foreground">(você)</span> : null}
          </span>
          <span className="text-xs text-muted-foreground break-all">{member.email}</span>
        </div>
      </TableCell>
      <TableCell className="p-0 align-top whitespace-normal">
        <form action={formAction} className="flex flex-wrap items-center gap-3 px-3 py-2">
          <input type="hidden" name="profileId" value={member.id} />
          <NativeSelect
            aria-label={`Perfil de ${member.full_name}`}
            name="role"
            value={role}
            onChange={(e) => {
              const newRole = e.target.value as AppRole;
              setRole(newRole);
              if (newRole !== "gestor") {
                setCanViewCosts(false);
              }
            }}
            className={cn(
              "w-36 h-8 text-sm transition-all",
              role !== member.role && "border-primary ring-1 ring-primary/40 font-medium",
            )}
          >
            <option value="colaborador">Colaborador</option>
            <option value="gestor">Gestor</option>
            <option value="admin">Administrador</option>
          </NativeSelect>

          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <NativeCheckbox
              name="canViewCosts"
              checked={canViewCosts}
              onChange={(e) => setCanViewCosts(e.target.checked)}
              disabled={role !== "gestor"}
              title={role === "gestor" ? undefined : "Disponível apenas para gestores"}
            />
            <span className={role === "gestor" ? "" : "text-muted-foreground"}>Vê custos</span>
          </label>

          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <NativeCheckbox
              name="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Ativo
          </label>

          {hasChanges ? (
            <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
              <SubmitButton size="sm" variant="default" className="shadow-xs font-medium">
                Salvar
              </SubmitButton>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRole(member.role);
                  setCanViewCosts(member.can_view_costs);
                  setActive(member.active);
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              >
                Cancelar
              </Button>
            </div>
          ) : null}

          {state.error || state.success ? (
            <div className="w-full">
              <FormAlert state={state} />
            </div>
          ) : null}
        </form>

        {/* Serve para quem ainda não criou a senha e para quem a esqueceu */}
        <form action={linkAction} className="px-3 pb-2">
          <input type="hidden" name="email" value={member.email} />
          <SubmitButton size="xs" variant="ghost">
            <LinkIcon />
            Link de acesso
          </SubmitButton>
          {linkState.error ? <p className="mt-1 text-xs text-destructive">{linkState.error}</p> : null}
          {linkState.link ? (
            <div className="mt-2 max-w-xl min-w-0">
              <CopyLink
                link={linkState.link}
                hint={`Mande para ${member.full_name} criar ou trocar a senha sem depender de e-mail.`}
              />
            </div>
          ) : null}
        </form>
      </TableCell>
    </TableRow>
  );
}

export function MembersTable({ members, currentUserId }: { members: Tables<"profiles">[]; currentUserId: string }) {
  const [filter, setFilter] = useState<"active" | "inactive">("active");

  const activeMembers = useMemo(
    () => members.filter((m) => m.active !== false),
    [members]
  );
  const inactiveMembers = useMemo(
    () => members.filter((m) => m.active === false),
    [members]
  );

  const filteredMembers = useMemo(
    () => (filter === "active" ? activeMembers : inactiveMembers),
    [filter, activeMembers, inactiveMembers]
  );

  return (
    <>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="grid gap-1">
          <CardTitle>Membros</CardTitle>
          <CardDescription>Perfil de acesso, permissão de ver custos individuais e status.</CardDescription>
        </div>

        {/* Filtro Ativos | Inativos */}
        <div className="inline-flex items-center gap-1 p-1 bg-muted/60 rounded-lg border border-border/50 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5",
              filter === "active"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Ativos</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                filter === "active"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {activeMembers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("inactive")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5",
              filter === "inactive"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Inativos</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                filter === "inactive"
                  ? "bg-muted-foreground/20 text-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {inactiveMembers.length}
            </span>
          </button>
        </div>
      </CardHeader>

      <CardContent>
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%] min-w-[180px]">Pessoa</TableHead>
              <TableHead className="w-[70%]">Acesso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => (
              <MemberRow
                key={`${member.id}-${member.role}-${member.can_view_costs}-${member.active}`}
                member={member}
                isCurrentUser={member.id === currentUserId}
              />
            ))}
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  {members.length === 0
                    ? "Nenhum membro ainda."
                    : filter === "active"
                      ? "Nenhum usuário ativo no momento."
                      : "Nenhum usuário inativo no momento."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </>
  );
}
