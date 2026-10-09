"use client";

import { useState, useTransition } from "react";
import {
  BanIcon,
  CalendarIcon,
  Edit3Icon,
  MoreHorizontalIcon,
  PlayIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { Field, FormAlert, SubmitButton } from "@/components/form";
import { useActionState } from "react";
import { initialActionState } from "@/lib/actions";
import type { Tables } from "@/lib/database.types";
import { getSubscriptionInfo } from "@/lib/subscription/status";
import {
  deleteTenantAction,
  extendTrialAction,
  toggleTenantStatusAction,
  updateTenantSubscriptionAction,
} from "./actions";

export type TenantRowData = Tables<"tenants"> & {
  membersCount: number;
};

export function TenantsTable({ tenants }: { tenants: TenantRowData[] }) {
  const [selectedTenant, setSelectedTenant] = useState<TenantRowData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTenants = tenants.filter((t) => {
    const term = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      (t.email_domain && t.email_domain.toLowerCase().includes(term)) ||
      (t.cnpj && t.cnpj.includes(term))
    );
  });

  const handleToggleStatus = (tenant: TenantRowData) => {
    const isSuspended = tenant.subscription_status === "suspended";
    const confirmMsg = isSuspended
      ? `Deseja reativar o acesso da empresa "${tenant.name}"?`
      : `Deseja suspender o acesso da empresa "${tenant.name}"? Os usuários não conseguirão acessar as funções até a reativação.`;

    if (!confirm(confirmMsg)) return;

    startTransition(async () => {
      await toggleTenantStatusAction(tenant.id, tenant.subscription_status);
    });
  };

  const handleExtendTrial = (tenant: TenantRowData, days: number) => {
    if (!confirm(`Prorrogar o teste da empresa "${tenant.name}" por mais ${days} dias?`)) return;

    startTransition(async () => {
      await extendTrialAction(tenant.id, days);
    });
  };

  const handleDeleteTenant = (tenant: TenantRowData) => {
    const confirmText = prompt(
      `ATENÇÃO: Você está prestes a EXCLUIR DEFINITIVAMENTE a empresa "${tenant.name}"!\n\nTodos os contratos, apontamentos, clientes e acessos vinculados serão apagados de forma irreversível.\n\nPara confirmar a exclusão, digite o nome exato da empresa abaixo:`
    );

    if (confirmText !== tenant.name) {
      if (confirmText !== null) {
        alert("O nome digitado não confere. Operação de exclusão cancelada.");
      }
      return;
    }

    startTransition(async () => {
      try {
        await deleteTenantAction(tenant.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao excluir empresa.";
        alert(msg);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar por nome, domínio ou CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground">
          {filteredTenants.length} {filteredTenants.length === 1 ? "empresa" : "empresas"}
        </span>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3.5">Empresa</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Modo & Plano</th>
                <th className="p-3.5">Validade / Teste</th>
                <th className="p-3.5 text-center">Usuários</th>
                <th className="p-3.5">Observações</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const subInfo = getSubscriptionInfo(t);
                  const isSuspended = t.subscription_status === "suspended";

                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 min-w-[200px]">
                        <p className="font-semibold text-foreground">{t.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {t.email_domain && <span>@{t.email_domain}</span>}
                          {t.cnpj && <span>· CNPJ: {t.cnpj}</span>}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <Badge
                          variant={
                            isSuspended
                              ? "destructive"
                              : subInfo.isActive
                              ? "default"
                              : "secondary"
                          }
                          className="capitalize text-xs font-medium"
                        >
                          {subInfo.statusLabel}
                        </Badge>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <p className="font-medium capitalize text-xs">{t.plan_tier || "Pro"}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {t.billing_mode === "manual" ? "Manual / Pix" : "Stripe"}
                        </p>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-xs text-muted-foreground">
                        {subInfo.formattedExpiration ? (
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                            <span>{subInfo.formattedExpiration}</span>
                          </div>
                        ) : (
                          "Sem data limite"
                        )}
                      </td>

                      <td className="p-3.5 text-center text-xs font-semibold">
                        {t.membersCount}
                      </td>

                      <td className="p-3.5 max-w-[220px] truncate text-xs text-muted-foreground" title={t.manual_notes ?? ""}>
                        {t.manual_notes || <span className="opacity-40">-</span>}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant={isSuspended ? "default" : "outline"}
                            className={
                              isSuspended
                                ? "h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                                : "h-8 text-destructive hover:bg-destructive/10 gap-1 text-xs"
                            }
                            onClick={() => handleToggleStatus(t)}
                            disabled={isPending}
                          >
                            {isSuspended ? (
                              <>
                                <PlayIcon className="size-3.5" />
                                Reativar
                              </>
                            ) : (
                              <>
                                <BanIcon className="size-3.5" />
                                Suspender
                              </>
                            )}
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreHorizontalIcon className="size-4" />
                                  <span className="sr-only">Opções</span>
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Gerenciar Empresa</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setSelectedTenant(t)}>
                                <Edit3Icon className="mr-2 size-4" />
                                Editar Assinatura
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                Prorrogar Teste
                              </DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleExtendTrial(t, 7)}>
                                <SparklesIcon className="mr-2 size-4 text-amber-500" />
                                +7 dias grátis
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExtendTrial(t, 14)}>
                                <SparklesIcon className="mr-2 size-4 text-amber-500" />
                                +14 dias grátis
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExtendTrial(t, 30)}>
                                <SparklesIcon className="mr-2 size-4 text-amber-500" />
                                +30 dias grátis
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteTenant(t)}
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                              >
                                <Trash2Icon className="mr-2 size-4 text-destructive" />
                                Excluir Empresa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTenant && (
        <EditTenantDialog
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </div>
  );
}

function EditTenantDialog({
  tenant,
  onClose,
}: {
  tenant: TenantRowData;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(updateTenantSubscriptionAction, initialActionState);

  const defaultDate = tenant.current_period_end
    ? new Date(tenant.current_period_end).toISOString().split("T")[0]
    : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Assinatura · {tenant.name}</DialogTitle>
          <DialogDescription>
            Ajuste o status, datas de vencimento e anotações do contrato manual.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4 py-2">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <FormAlert state={state} />

          <Field
            label="Status da assinatura"
            htmlFor="subscriptionStatus"
            errors={state.fieldErrors?.subscriptionStatus}
          >
            <NativeSelect
              id="subscriptionStatus"
              name="subscriptionStatus"
              defaultValue={tenant.subscription_status}
            >
              <option value="manual_active">Ativa Manualmente (Liberada)</option>
              <option value="trialing">Em Teste (Trial)</option>
              <option value="suspended">Suspensa (Acesso Bloqueado)</option>
              <option value="past_due">Inadimplente / Pagamento Pendente</option>
              <option value="active">Ativa (Padrão)</option>
              <option value="canceled">Cancelada</option>
            </NativeSelect>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Modo de cobrança" htmlFor="billingMode" errors={state.fieldErrors?.billingMode}>
              <NativeSelect
                id="billingMode"
                name="billingMode"
                defaultValue={tenant.billing_mode}
              >
                <option value="manual">Manual (Pix / Contrato)</option>
                <option value="stripe">Stripe (Automático)</option>
              </NativeSelect>
            </Field>

            <Field label="Plano" htmlFor="planTier" errors={state.fieldErrors?.planTier}>
              <NativeSelect id="planTier" name="planTier" defaultValue={tenant.plan_tier || "pro"}>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </NativeSelect>
            </Field>
          </div>

          <Field
            label="Vencimento da mensalidade"
            htmlFor="currentPeriodEnd"
            hint="Deixe vazio para manter sem vencimento fixo."
            errors={state.fieldErrors?.currentPeriodEnd}
          >
            <Input
              id="currentPeriodEnd"
              name="currentPeriodEnd"
              type="date"
              defaultValue={defaultDate}
            />
          </Field>

          <Field
            label="Observações internas"
            htmlFor="manualNotes"
            hint="Apenas você enxerga estas notas."
            errors={state.fieldErrors?.manualNotes}
          >
            <Textarea
              id="manualNotes"
              name="manualNotes"
              rows={2}
              defaultValue={tenant.manual_notes ?? ""}
              placeholder="Ex: Mensalidade R$ 350 paga via Pix no dia 10."
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <SubmitButton>Salvar Alterações</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
