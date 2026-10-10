"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  BanIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  Edit3Icon,
  LogInIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PlayIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
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
  impersonateTenantAction,
  toggleTenantStatusAction,
  updateTenantMaxUsersAction,
  updateTenantSubscriptionAction,
} from "./actions";

export type TenantRowData = Tables<"tenants"> & {
  membersCount: number;
};

type FilterStatus = "all" | "active" | "trialing" | "expiring_soon" | "suspended";

export function TenantsTable({ tenants }: { tenants: TenantRowData[] }) {
  const [selectedTenant, setSelectedTenant] = useState<TenantRowData | null>(null);
  const [whatsAppTenant, setWhatsAppTenant] = useState<TenantRowData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  // Contagens para os filtros
  const counts = {
    all: tenants.length,
    active: tenants.filter(
      (t) => t.subscription_status === "manual_active" || t.subscription_status === "active"
    ).length,
    trialing: tenants.filter((t) => t.subscription_status === "trialing").length,
    expiring_soon: tenants.filter((t) => {
      const sub = getSubscriptionInfo(t);
      return (
        sub.daysRemaining !== null &&
        sub.daysRemaining >= 0 &&
        sub.daysRemaining <= 7 &&
        t.subscription_status !== "suspended" &&
        t.subscription_status !== "canceled"
      );
    }).length,
    suspended: tenants.filter(
      (t) =>
        t.subscription_status === "suspended" ||
        t.subscription_status === "past_due" ||
        t.subscription_status === "canceled"
    ).length,
  };

  const filteredTenants = tenants.filter((t) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      t.name.toLowerCase().includes(term) ||
      (t.email_domain && t.email_domain.toLowerCase().includes(term)) ||
      (t.cnpj && t.cnpj.includes(term));

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;

    if (statusFilter === "active") {
      return t.subscription_status === "manual_active" || t.subscription_status === "active";
    }

    if (statusFilter === "trialing") {
      return t.subscription_status === "trialing";
    }

    if (statusFilter === "expiring_soon") {
      const sub = getSubscriptionInfo(t);
      return (
        sub.daysRemaining !== null &&
        sub.daysRemaining >= 0 &&
        sub.daysRemaining <= 7 &&
        t.subscription_status !== "suspended" &&
        t.subscription_status !== "canceled"
      );
    }

    if (statusFilter === "suspended") {
      return (
        t.subscription_status === "suspended" ||
        t.subscription_status === "past_due" ||
        t.subscription_status === "canceled"
      );
    }

    return true;
  });

  const handleImpersonate = (tenant: TenantRowData) => {
    startTransition(async () => {
      try {
        await impersonateTenantAction(tenant.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao acessar workspace.";
        alert(msg);
      }
    });
  };

  const handleToggleStatus = (tenant: TenantRowData) => {
    const isSuspended = tenant.subscription_status === "suspended";
    const confirmMsg = isSuspended
      ? `Deseja reativar o acesso da empresa "${tenant.name}"?`
      : `Deseja suspender o acesso da empresa "${tenant.name}"?\n\nOs usuários da empresa verão uma mensagem orientando a contatar o administrador para resolução.`;

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

  const handleQuickSetMaxUsers = (tenant: TenantRowData) => {
    const current = tenant.max_users ? String(tenant.max_users) : "";
    const input = prompt(
      `Defina a quantidade máxima de usuários para a empresa "${tenant.name}":\n\n(Deixe vazio ou digite 0 para permitir usuários ilimitados)`,
      current
    );
    if (input === null) return;
    const trimmed = input.trim();
    const val = trimmed === "" || trimmed === "0" ? null : parseInt(trimmed, 10);
    if (val !== null && (isNaN(val) || val < 1)) {
      alert("Por favor, informe um número inteiro positivo (ex: 5, 10) ou deixe vazio para ilimitado.");
      return;
    }

    startTransition(async () => {
      try {
        await updateTenantMaxUsersAction(tenant.id, val);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao atualizar limite.";
        alert(msg);
      }
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
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Input
          placeholder="Buscar por nome, domínio ou CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            className="h-8 text-xs cursor-pointer"
            onClick={() => setStatusFilter("all")}
          >
            Todas ({counts.all})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "outline"}
            className="h-8 text-xs cursor-pointer"
            onClick={() => setStatusFilter("active")}
          >
            Ativas ({counts.active})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "trialing" ? "default" : "outline"}
            className="h-8 text-xs cursor-pointer"
            onClick={() => setStatusFilter("trialing")}
          >
            Em Teste ({counts.trialing})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "expiring_soon" ? "default" : "outline"}
            className={`h-8 text-xs cursor-pointer ${
              counts.expiring_soon > 0 && statusFilter !== "expiring_soon"
                ? "border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                : ""
            }`}
            onClick={() => setStatusFilter("expiring_soon")}
          >
            A Vencer ({counts.expiring_soon})
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "suspended" ? "default" : "outline"}
            className="h-8 text-xs cursor-pointer"
            onClick={() => setStatusFilter("suspended")}
          >
            Suspensas ({counts.suspended})
          </Button>
        </div>
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
                    Nenhuma empresa encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const subInfo = getSubscriptionInfo(t);
                  const isSuspended = t.subscription_status === "suspended";
                  const isExpiringSoon =
                    subInfo.daysRemaining !== null &&
                    subInfo.daysRemaining >= 0 &&
                    subInfo.daysRemaining <= 7 &&
                    !isSuspended;

                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 min-w-[200px]">
                        <p className="font-semibold text-foreground">{t.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {t.email_domain && <span>@{t.email_domain}</span>}
                          {t.cnpj && <span>· CNPJ: {t.cnpj}</span>}
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
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

                      <td className="p-3.5 whitespace-nowrap text-xs">
                        {subInfo.formattedExpiration ? (
                          <div
                            className={`flex items-center gap-1.5 ${
                              isExpiringSoon
                                ? "font-semibold text-amber-600 dark:text-amber-400"
                                : isSuspended
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isExpiringSoon ? (
                              <AlertTriangleIcon className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            ) : (
                              <CalendarIcon className="size-3.5 shrink-0" />
                            )}
                            <span>{subInfo.formattedExpiration}</span>
                            {isExpiringSoon && (
                              <span className="text-[10px] bg-amber-500/15 px-1 py-0.2 rounded font-normal">
                                {subInfo.daysRemaining === 0
                                  ? "Vence hoje!"
                                  : `(${subInfo.daysRemaining}d)`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sem data limite</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center text-xs">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="font-semibold text-foreground">
                            {t.membersCount}
                            {t.max_users ? ` / ${t.max_users}` : ""}
                          </span>
                          {t.max_users ? (
                            t.membersCount >= t.max_users ? (
                              <span className="text-[10px] text-destructive font-medium bg-destructive/10 px-1.5 py-0.2 rounded">
                                Limite atingido
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                {t.max_users - t.membersCount} {t.max_users - t.membersCount === 1 ? "vaga" : "vagas"}
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-muted-foreground">ilimitado</span>
                          )}
                        </div>
                      </td>

                      <td
                        className="p-3.5 max-w-[200px] truncate text-xs text-muted-foreground"
                        title={t.manual_notes ?? ""}
                      >
                        {t.manual_notes || <span className="opacity-40">-</span>}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão rápido para entrar como a empresa no modo suporte */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer"
                            onClick={() => handleImpersonate(t)}
                            disabled={isPending}
                            title="Acessar painel como esta empresa (Modo Suporte)"
                          >
                            <LogInIcon className="size-3.5" />
                            <span className="hidden md:inline">Acessar</span>
                          </Button>

                          <Button
                            size="sm"
                            variant={isSuspended ? "default" : "outline"}
                            className={
                              isSuspended
                                ? "h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs cursor-pointer"
                                : "h-8 text-destructive hover:bg-destructive/10 gap-1 text-xs cursor-pointer"
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

                          {/* Botão direto e visível para Excluir Empresa */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/60 cursor-pointer"
                            onClick={() => handleDeleteTenant(t)}
                            disabled={isPending}
                            title="Excluir empresa definitivamente"
                          >
                            <Trash2Icon className="size-3.5 text-destructive" />
                            <span className="hidden sm:inline">Excluir</span>
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
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel>Gerenciar Empresa</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleImpersonate(t)}
                                className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium"
                              >
                                <LogInIcon className="mr-2 size-4" />
                                Acessar como Empresa
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => setWhatsAppTenant(t)}
                                className="cursor-pointer text-emerald-600 dark:text-emerald-400"
                              >
                                <MessageCircleIcon className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
                                Cobrar via WhatsApp
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => setSelectedTenant(t)}
                                className="cursor-pointer"
                              >
                                <Edit3Icon className="mr-2 size-4" />
                                Editar Assinatura
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleQuickSetMaxUsers(t)}
                                className="cursor-pointer font-medium text-primary"
                              >
                                <UsersIcon className="mr-2 size-4 text-primary" />
                                Limite de Usuários ({t.max_users ? `${t.max_users} máx` : "Ilimitado"})
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                Prorrogar Teste
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleExtendTrial(t, 7)}
                                className="cursor-pointer"
                              >
                                <SparklesIcon className="mr-2 size-4 text-amber-500" />
                                +7 dias grátis
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExtendTrial(t, 14)}
                                className="cursor-pointer"
                              >
                                <SparklesIcon className="mr-2 size-4 text-amber-500" />
                                +14 dias grátis
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleExtendTrial(t, 30)}
                                className="cursor-pointer"
                              >
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
          onDelete={() => handleDeleteTenant(selectedTenant)}
        />
      )}

      {whatsAppTenant && (
        <WhatsAppReminderDialog
          tenant={whatsAppTenant}
          onClose={() => setWhatsAppTenant(null)}
        />
      )}
    </div>
  );
}

function WhatsAppReminderDialog({
  tenant,
  onClose,
}: {
  tenant: TenantRowData;
  onClose: () => void;
}) {
  const subInfo = getSubscriptionInfo(tenant);
  const expirationText = subInfo.formattedExpiration || "vencimento em aberto";

  const defaultMsg = `Olá! Tudo bem?

Passando para lembrar sobre a renovação da assinatura do Sis.Chronos da empresa *${tenant.name}*.

📅 Vencimento: ${expirationText}
📌 Plano: ${tenant.plan_tier ? tenant.plan_tier.toUpperCase() : "PRO"}
💳 Chave Pix: financeiro@suaempresa.com.br (ou seu CNPJ)

Qualquer dúvida ou caso o pagamento já tenha sido realizado, pode nos enviar o comprovante por aqui. Obrigado!`;

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(defaultMsg);
  const [copied, setCopied] = useState(false);

  const handleOpenWhatsApp = () => {
    const clean = phone.replace(/\D/g, "");
    const targetUrl = clean
      ? `https://wa.me/55${clean}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(targetUrl, "_blank");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-6 sm:p-7 gap-5 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-1">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageCircleIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
            Lembrete de Cobrança WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Envie uma mensagem de cobrança ou renovação rápida diretamente para o responsável da
            empresa <strong>{tenant.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Field
            label="Número de WhatsApp com DDD"
            htmlFor="whatsappPhone"
            hint="Opcional. Se preenchido, abre a conversa com o número exato."
          >
            <Input
              id="whatsappPhone"
              placeholder="Ex: 11999998888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          <Field label="Mensagem Formatada" htmlFor="whatsappMessage">
            <Textarea
              id="whatsappMessage"
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs font-mono leading-relaxed"
            />
          </Field>

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <CheckIcon className="size-3.5 text-emerald-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <CopyIcon className="size-3.5" />
                  Copiar Texto
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Fechar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs"
                onClick={handleOpenWhatsApp}
              >
                <MessageCircleIcon className="size-3.5" />
                Abrir WhatsApp Web
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditTenantDialog({
  tenant,
  onClose,
  onDelete,
}: {
  tenant: TenantRowData;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [state, formAction] = useActionState(updateTenantSubscriptionAction, initialActionState);

  const defaultDate = tenant.current_period_end
    ? new Date(tenant.current_period_end).toISOString().split("T")[0]
    : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-6 sm:p-7 gap-5 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-1">
          <DialogTitle className="text-lg">Editar Assinatura · {tenant.name}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Ajuste o status, datas de vencimento e anotações do contrato manual.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 pt-1">
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

          <div className="grid gap-3.5 sm:grid-cols-2">
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

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field
              label="Vencimento da mensalidade"
              htmlFor="currentPeriodEnd"
              hint="Deixe vazio para sem vencimento fixo."
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
              label="Limite de usuários"
              htmlFor="maxUsers"
              hint="Vazio ou 0 = ilimitado."
              errors={state.fieldErrors?.maxUsers}
            >
              <Input
                id="maxUsers"
                name="maxUsers"
                type="number"
                min="1"
                placeholder="Ex: 10 (vazio = ilimitado)"
                defaultValue={tenant.max_users ?? ""}
              />
            </Field>
          </div>

          <Field
            label="Observações internas"
            htmlFor="manualNotes"
            hint="Apenas você enxerga estas notas."
            errors={state.fieldErrors?.manualNotes}
          >
            <Textarea
              id="manualNotes"
              name="manualNotes"
              rows={3}
              defaultValue={tenant.manual_notes ?? ""}
              placeholder="Ex: Mensalidade R$ 350 paga via Pix no dia 10."
            />
          </Field>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-3 border-t">
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive/60 text-xs h-9 gap-1.5 cursor-pointer w-full sm:w-auto"
              onClick={() => {
                onClose();
                onDelete();
              }}
            >
              <Trash2Icon className="size-3.5 text-destructive" />
              Excluir Empresa
            </Button>

            <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
              <Button type="button" variant="outline" className="h-9 text-xs" onClick={onClose}>
                Cancelar
              </Button>
              <SubmitButton className="h-9 text-xs">Salvar Alterações</SubmitButton>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
