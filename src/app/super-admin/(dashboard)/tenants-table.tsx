"use client";

import { useState, useTransition } from "react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowUpDownIcon,
  BanIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  Edit3Icon,
  ExternalLinkIcon,
  HeartPulseIcon,
  KeyRoundIcon,
  LinkIcon,
  LogInIcon,
  MailIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  UserCheckIcon,
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
import { calculateTenantMrr, extractCustomMrr } from "@/lib/subscription/mrr";
import {
  deleteTenantAction,
  extendTrialAction,
  generateAdminAccessLinkAction,
  getTenantHealthAction,
  impersonateTenantAction,
  toggleTenantStatusAction,
  updateTenantMaxUsersAction,
  updateTenantSubscriptionAction,
  type TenantHealthData,
} from "./actions";

export type TenantMember = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

export type TenantRowData = Tables<"tenants"> & {
  membersCount: number;
  users: TenantMember[];
  primaryAdmin: TenantMember | null;
};

type FilterStatus = "all" | "active" | "trialing" | "expiring_soon" | "suspended";
type SortOption =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "expiring_asc"
  | "mrr_desc"
  | "users_desc";

export function TenantsTable({ tenants }: { tenants: TenantRowData[] }) {
  const [selectedTenant, setSelectedTenant] = useState<TenantRowData | null>(null);
  const [whatsAppTenant, setWhatsAppTenant] = useState<TenantRowData | null>(null);
  const [viewUsersTenant, setViewUsersTenant] = useState<TenantRowData | null>(null);
  const [healthTenant, setHealthTenant] = useState<TenantRowData | null>(null);
  const [accessLinkState, setAccessLinkState] = useState<{
    open: boolean;
    tenantName: string;
    email: string;
    link: string | null;
    loading: boolean;
    error?: string;
  }>({
    open: false,
    tenantName: "",
    email: "",
    link: null,
    loading: false,
  });

  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    const adminEmail = t.primaryAdmin?.email.toLowerCase() ?? "";
    const adminName = t.primaryAdmin?.fullName.toLowerCase() ?? "";
    const matchesSearch =
      t.name.toLowerCase().includes(term) ||
      (t.email_domain && t.email_domain.toLowerCase().includes(term)) ||
      (t.cnpj && t.cnpj.includes(term)) ||
      adminEmail.includes(term) ||
      adminName.includes(term);

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

  const sortedTenants = [...filteredTenants].sort((a, b) => {
    if (sortBy === "name_asc") return a.name.localeCompare(b.name, "pt-BR");
    if (sortBy === "name_desc") return b.name.localeCompare(a.name, "pt-BR");
    if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === "users_desc") return b.membersCount - a.membersCount;
    if (sortBy === "mrr_desc") return calculateTenantMrr(b) - calculateTenantMrr(a);
    if (sortBy === "expiring_asc") {
      const subA = getSubscriptionInfo(a);
      const subB = getSubscriptionInfo(b);
      const daysA = subA.daysRemaining ?? 99999;
      const daysB = subB.daysRemaining ?? 99999;
      return daysA - daysB;
    }
    // Padrão: newest
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
        alert(err instanceof Error ? err.message : "Erro ao atualizar limite.");
      }
    });
  };

  const handleDeleteTenant = (tenant: TenantRowData) => {
    const confirmation = prompt(
      `ATENÇÃO: Ação irreversível!\n\n` +
        `Para confirmar a EXCLUSÃO DEFINITIVA da empresa "${tenant.name}", digite o nome exato da empresa abaixo:\n\n` +
        `Todos os dados (contratos, apontamentos, colaboradores e logins) serão excluídos.`
    );

    if (confirmation === null) return;

    if (confirmation.trim().toLowerCase() !== tenant.name.trim().toLowerCase()) {
      alert("Nome digitado não confere. Exclusão cancelada por segurança.");
      return;
    }

    startTransition(async () => {
      try {
        await deleteTenantAction(tenant.id);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao excluir empresa.");
      }
    });
  };

  const handleGenerateAccessLink = (email: string, tenantName: string, tenantId?: string) => {
    setAccessLinkState({
      open: true,
      tenantName,
      email,
      link: null,
      loading: true,
    });

    startTransition(async () => {
      try {
        const res = await generateAdminAccessLinkAction(email, tenantName, tenantId);
        if (res.ok) {
          setAccessLinkState((prev) => ({
            ...prev,
            link: res.link,
            loading: false,
          }));
        } else {
          setAccessLinkState((prev) => ({
            ...prev,
            error: res.error,
            loading: false,
          }));
        }
      } catch (err) {
        setAccessLinkState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Erro ao gerar link de acesso.",
          loading: false,
        }));
      }
    });
  };

  const handleExportCsv = () => {
    const headers = [
      "Empresa",
      "CNPJ",
      "Domínio",
      "Status",
      "Plano",
      "MRR (R$)",
      "ARR (R$)",
      "Vencimento",
      "Dias Restantes",
      "Usuários Cadastrados",
      "Limite de Vagas",
      "Admin Principal",
      "E-mail do Admin",
      "Data de Cadastro",
      "Observações",
    ];

    const rows = sortedTenants.map((t) => {
      const sub = getSubscriptionInfo(t);
      const mrrVal = calculateTenantMrr(t);
      return [
        `"${t.name.replace(/"/g, '""')}"`,
        `"${t.cnpj ?? ""}"`,
        `"${t.email_domain ?? ""}"`,
        `"${sub.statusLabel}"`,
        `"${t.plan_tier || "pro"}"`,
        mrrVal.toFixed(2),
        (mrrVal * 12).toFixed(2),
        `"${sub.formattedExpiration ?? "Sem limite"}"`,
        sub.daysRemaining ?? "",
        t.membersCount,
        t.max_users ?? "Ilimitado",
        `"${t.primaryAdmin?.fullName.replace(/"/g, '""') ?? ""}"`,
        `"${t.primaryAdmin?.email ?? ""}"`,
        `"${new Date(t.created_at).toLocaleDateString("pt-BR")}"`,
        `"${(t.manual_notes ?? "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `empresas_sis_chronos_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros, Busca, Ordenação e Exportação */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            className="h-8 text-xs cursor-pointer"
          >
            Todas ({counts.all})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "active" ? "default" : "outline"}
            onClick={() => setStatusFilter("active")}
            className="h-8 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/20 cursor-pointer"
          >
            Ativas ({counts.active})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "trialing" ? "default" : "outline"}
            onClick={() => setStatusFilter("trialing")}
            className="h-8 text-xs text-amber-600 dark:text-amber-400 border-amber-500/20 cursor-pointer"
          >
            Em Teste ({counts.trialing})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "expiring_soon" ? "default" : "outline"}
            onClick={() => setStatusFilter("expiring_soon")}
            className="h-8 text-xs text-amber-700 dark:text-amber-300 border-amber-500/30 cursor-pointer"
          >
            A Vencer ({counts.expiring_soon})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "suspended" ? "default" : "outline"}
            onClick={() => setStatusFilter("suspended")}
            className="h-8 text-xs text-destructive border-destructive/20 cursor-pointer"
          >
            Suspensas ({counts.suspended})
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Campo de Busca */}
          <div className="relative min-w-[200px] flex-1 sm:w-64">
            <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ, domínio ou admin..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-1.5">
            <NativeSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-8 text-xs w-[170px]"
            >
              <option value="newest">Mais Recentes</option>
              <option value="name_asc">Nome (A - Z)</option>
              <option value="name_desc">Nome (Z - A)</option>
              <option value="expiring_asc">Próximo a Vencer</option>
              <option value="mrr_desc">Maior MRR</option>
              <option value="users_desc">Mais Usuários</option>
              <option value="oldest">Mais Antigas</option>
            </NativeSelect>
          </div>

          {/* Botão de Exportar CSV */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs cursor-pointer"
            onClick={handleExportCsv}
            title="Exportar dados das empresas filtradas em CSV para Excel"
          >
            <DownloadIcon className="size-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Tabela de Empresas */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="p-3.5">Empresa & Responsável</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Plano & Receita</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5 text-center">Usuários</th>
                <th className="p-3.5">Notas Internas</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sortedTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    Nenhuma empresa encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                sortedTenants.map((t) => {
                  const subInfo = getSubscriptionInfo(t);
                  const isSuspended = t.subscription_status === "suspended";
                  const isExpiringSoon =
                    subInfo.daysRemaining !== null &&
                    subInfo.daysRemaining >= 0 &&
                    subInfo.daysRemaining <= 7 &&
                    !isSuspended;

                  const mrrVal = calculateTenantMrr(t);
                  const customMrr = extractCustomMrr(t.manual_notes);

                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      {/* Empresa e Administrador Principal */}
                      <td className="p-3.5 min-w-[240px]">
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <button
                              onClick={() => setHealthTenant(t)}
                              className="font-semibold text-foreground hover:text-primary transition-colors text-left flex items-center gap-1.5 group cursor-pointer"
                              title="Clique para ver a visão 360° e saúde da empresa"
                            >
                              <span>{t.name}</span>
                              <HeartPulseIcon className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              {t.email_domain && <span>@{t.email_domain}</span>}
                              {t.cnpj && <span>· CNPJ: {t.cnpj}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Admin / Contato Principal */}
                        {t.primaryAdmin ? (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] bg-muted/40 px-2 py-1 rounded-md border border-border/40 max-w-fit">
                            <UserCheckIcon className="size-3 text-primary shrink-0" />
                            <span className="font-medium text-foreground truncate max-w-[120px]" title={t.primaryAdmin.fullName}>
                              {t.primaryAdmin.fullName}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground truncate max-w-[150px]" title={t.primaryAdmin.email}>
                              {t.primaryAdmin.email}
                            </span>
                            <button
                              onClick={() => copyToClipboard(t.primaryAdmin!.email, `mail-${t.id}`)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                              title="Copiar e-mail do admin"
                            >
                              {copiedId === `mail-${t.id}` ? (
                                <CheckIcon className="size-3 text-emerald-500" />
                              ) : (
                                <CopyIcon className="size-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-muted-foreground/60 italic">
                            Sem admin cadastrado
                          </div>
                        )}
                      </td>

                      {/* Status */}
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

                      {/* Plano & MRR */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium capitalize text-xs">{t.plan_tier || "Pro"}</p>
                          {customMrr !== null && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 border-indigo-400 text-indigo-600 dark:text-indigo-400">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {mrrVal > 0 ? (
                            <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              R$ {mrrVal.toLocaleString("pt-BR")}/mês
                            </strong>
                          ) : (
                            <span className="opacity-70">R$ 0/mês</span>
                          )}
                          <span className="ml-1 text-[10px] opacity-75">
                            ({t.billing_mode === "manual" ? "Pix" : "Stripe"})
                          </span>
                        </p>
                      </td>

                      {/* Vencimento */}
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

                      {/* Usuários e Vagas */}
                      <td className="p-3.5 text-center text-xs whitespace-nowrap">
                        <button
                          onClick={() => setViewUsersTenant(t)}
                          className="flex flex-col items-center justify-center gap-0.5 mx-auto group cursor-pointer"
                          title="Clique para ver os usuários cadastrados"
                        >
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                            <span>{t.membersCount}</span>
                            {t.max_users ? ` / ${t.max_users}` : ""}
                            <UsersIcon className="size-3 opacity-50 group-hover:opacity-100" />
                          </span>
                          {t.max_users ? (
                            t.membersCount >= t.max_users ? (
                              <span className="text-[10px] text-destructive font-medium bg-destructive/10 px-1.5 py-0.2 rounded">
                                Limite atingido
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                {t.max_users - t.membersCount}{" "}
                                {t.max_users - t.membersCount === 1 ? "vaga" : "vagas"}
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] text-muted-foreground">ilimitado</span>
                          )}
                        </button>
                      </td>

                      {/* Notas */}
                      <td
                        className="p-3.5 max-w-[180px] truncate text-xs text-muted-foreground"
                        title={t.manual_notes ?? ""}
                      >
                        {t.manual_notes ? (
                          t.manual_notes.replace(/\[MRR:\s*\d+(?:[.,]\d+)?\]/gi, "").trim() ||
                          <span className="opacity-40">-</span>
                        ) : (
                          <span className="opacity-40">-</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Acessar (Modo suporte) */}
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

                          {/* Suspender / Reativar */}
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

                          {/* Menu Completo ... */}
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreHorizontalIcon className="size-4" />
                                  <span className="sr-only">Opções</span>
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Gerenciar {t.name}</DropdownMenuLabel>

                              <DropdownMenuItem
                                onClick={() => setHealthTenant(t)}
                                className="cursor-pointer text-foreground font-medium"
                              >
                                <HeartPulseIcon className="mr-2 size-4 text-emerald-500" />
                                Visão 360° e Saúde
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => setViewUsersTenant(t)}
                                className="cursor-pointer"
                              >
                                <UsersIcon className="mr-2 size-4 text-primary" />
                                Ver Usuários ({t.membersCount})
                              </DropdownMenuItem>

                              {t.primaryAdmin && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleGenerateAccessLink(
                                      t.primaryAdmin!.email,
                                      t.name,
                                      t.id
                                    )
                                  }
                                  className="cursor-pointer text-indigo-600 dark:text-indigo-400"
                                >
                                  <KeyRoundIcon className="mr-2 size-4" />
                                  Gerar Link de Login
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                onClick={() => setWhatsAppTenant(t)}
                                className="cursor-pointer text-emerald-600 dark:text-emerald-400"
                              >
                                <MessageCircleIcon className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
                                Cobrar via WhatsApp
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => setSelectedTenant(t)}
                                className="cursor-pointer"
                              >
                                <Edit3Icon className="mr-2 size-4" />
                                Editar Assinatura / MRR
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleQuickSetMaxUsers(t)}
                                className="cursor-pointer font-medium text-primary"
                              >
                                <UsersIcon className="mr-2 size-4 text-primary" />
                                Limite de Vagas ({t.max_users ? `${t.max_users} máx` : "Ilimitado"})
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

      {/* Dialog: Editar Assinatura e MRR Customizado */}
      {selectedTenant && (
        <EditTenantDialog
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onDelete={() => handleDeleteTenant(selectedTenant)}
        />
      )}

      {/* Dialog: Lembrete de Cobrança WhatsApp */}
      {whatsAppTenant && (
        <WhatsAppReminderDialog
          tenant={whatsAppTenant}
          onClose={() => setWhatsAppTenant(null)}
        />
      )}

      {/* Dialog: Lista de Usuários da Empresa */}
      {viewUsersTenant && (
        <TenantUsersDialog
          tenant={viewUsersTenant}
          onClose={() => setViewUsersTenant(null)}
          onGenerateAccessLink={(email) =>
            handleGenerateAccessLink(email, viewUsersTenant.name, viewUsersTenant.id)
          }
        />
      )}

      {/* Dialog: Visão 360° e Saúde da Empresa */}
      {healthTenant && (
        <TenantHealthDialog
          tenant={healthTenant}
          onClose={() => setHealthTenant(null)}
          onImpersonate={() => handleImpersonate(healthTenant)}
        />
      )}

      {/* Dialog: Link Mágico de Login */}
      {accessLinkState.open && (
        <AccessLinkDialog
          state={accessLinkState}
          onClose={() => setAccessLinkState((prev) => ({ ...prev, open: false }))}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Componente: Visualizador de Usuários da Empresa
// ---------------------------------------------------------------------
function TenantUsersDialog({
  tenant,
  onClose,
  onGenerateAccessLink,
}: {
  tenant: TenantRowData;
  onClose: () => void;
  onGenerateAccessLink: (email: string) => void;
}) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="size-5 text-primary" />
            Usuários de {tenant.name}
          </DialogTitle>
          <DialogDescription>
            {tenant.membersCount} usuário(s) registrado(s) · Limite contratado:{" "}
            {tenant.max_users ? `${tenant.max_users} usuários` : "Ilimitado"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 pt-2 max-h-[55vh]">
          {tenant.users.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Nenhum usuário com login registrado nesta empresa.
            </p>
          ) : (
            tenant.users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground truncate">{u.fullName}</p>
                    <Badge
                      variant={u.role === "admin" ? "default" : "secondary"}
                      className="text-[10px] capitalize px-1.5 py-0"
                    >
                      {u.role === "admin"
                        ? "Administrador"
                        : u.role === "manager"
                        ? "Gestor"
                        : "Colaborador"}
                    </Badge>
                    {!u.active && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{u.email}</span>
                    <button
                      onClick={() => copyEmail(u.email)}
                      className="hover:text-foreground transition-colors p-0.5"
                      title="Copiar e-mail"
                    >
                      {copiedEmail === u.email ? (
                        <CheckIcon className="size-3 text-emerald-500" />
                      ) : (
                        <CopyIcon className="size-3" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 shrink-0 cursor-pointer"
                  onClick={() => onGenerateAccessLink(u.email)}
                  title="Gerar link mágico de login sem necessidade de senha"
                >
                  <KeyRoundIcon className="size-3.5" />
                  <span>Link de Login</span>
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Componente: Modal de Link de Acesso Gerado
// ---------------------------------------------------------------------
function AccessLinkDialog({
  state,
  onClose,
}: {
  state: {
    open: boolean;
    tenantName: string;
    email: string;
    link: string | null;
    loading: boolean;
    error?: string;
  };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (state.link) {
      navigator.clipboard.writeText(state.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleWhatsApp = () => {
    if (!state.link) return;
    const msg = encodeURIComponent(
      `Olá! Segue seu link direto de acesso ao Sis.Chronos (${state.tenantName}):\n\n${state.link}\n\nEste link permite que você entre com total segurança sem precisar de senha.`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-5 text-indigo-500" />
            Link Mágico de Acesso
          </DialogTitle>
          <DialogDescription>
            Acesso gerado para <strong>{state.email}</strong> ({state.tenantName}).
          </DialogDescription>
        </DialogHeader>

        {state.loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCwIcon className="size-4 animate-spin text-primary" />
            <span>Gerando link seguro...</span>
          </div>
        ) : state.error ? (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {state.error}
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Link de Acesso Único</label>
              <div className="flex gap-2">
                <Input readOnly value={state.link ?? ""} className="text-xs font-mono select-all" />
                <Button size="sm" onClick={handleCopy} className="gap-1.5 shrink-0 cursor-pointer">
                  {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>

            <div className="p-3 bg-muted/30 border rounded-lg text-xs text-muted-foreground leading-relaxed">
              💡 <strong>Como funciona:</strong> Ao clicar nesse link, o usuário é autenticado
              diretamente e redirecionado para a empresa, dispensando a digitação de senha.
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleWhatsApp}
                className="gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer"
              >
                <MessageCircleIcon className="size-4" />
                Enviar via WhatsApp
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Componente: Visão 360° e Saúde da Empresa
// ---------------------------------------------------------------------
function TenantHealthDialog({
  tenant,
  onClose,
  onImpersonate,
}: {
  tenant: TenantRowData;
  onClose: () => void;
  onImpersonate: () => void;
}) {
  const [health, setHealth] = useState<TenantHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const sub = getSubscriptionInfo(tenant);

  useState(() => {
    let mounted = true;
    getTenantHealthAction(tenant.id)
      .then((data) => {
        if (mounted) {
          setHealth(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulseIcon className="size-5 text-emerald-500" />
            Visão 360° · {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Diagnóstico de adoção, volume de dados e engajamento da empresa.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCwIcon className="size-4 animate-spin text-primary" />
            <span>Calculando engajamento e histórico...</span>
          </div>
        ) : !health ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Falha ao carregar indicadores de saúde.
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Status de Saúde da Conta */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                health.status === "engaged"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : health.status === "low_activity"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ActivityIcon className="size-5 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    {health.status === "engaged"
                      ? "Conta Ativa e Engajada"
                      : health.status === "low_activity"
                      ? "Atenção: Baixo Engajamento"
                      : "Alerta: Conta Inativa / Sem Uso"}
                  </p>
                  <p className="text-xs opacity-85">
                    {health.status === "engaged"
                      ? "Empresa registrando apontamentos regularmente nos últimos 7 dias."
                      : health.status === "low_activity"
                      ? "Mais de 7 dias sem novos lançamentos de horas registrados."
                      : "Nenhum apontamento nos últimos 30 dias. Risco iminente de churn."}
                  </p>
                </div>
              </div>
            </div>

            {/* Grid de Estatísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg border bg-muted/20 text-center">
                <p className="text-xs text-muted-foreground">Colaboradores</p>
                <p className="text-xl font-bold mt-0.5">{health.activeEmployeesCount}</p>
                <span className="text-[10px] text-muted-foreground">de {health.employeesCount} total</span>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20 text-center">
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-xl font-bold mt-0.5">{health.clientsCount}</p>
                <span className="text-[10px] text-muted-foreground">cadastrados</span>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20 text-center">
                <p className="text-xs text-muted-foreground">Contratos</p>
                <p className="text-xl font-bold mt-0.5">{health.contractsCount}</p>
                <span className="text-[10px] text-muted-foreground">projetos ativos</span>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20 text-center">
                <p className="text-xs text-muted-foreground">Horas (30 dias)</p>
                <p className="text-xl font-bold mt-0.5 text-primary">{health.recentHoursTotal}h</p>
                <span className="text-[10px] text-muted-foreground">{health.recentEntriesCount} lançamentos</span>
              </div>
            </div>

            {/* Informações de Cadastro & Assinatura */}
            <div className="rounded-lg border p-3.5 space-y-2 text-xs bg-card">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Plano Atual:</span>
                <span className="font-semibold capitalize">{tenant.plan_tier || "Pro"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Status da Assinatura:</span>
                <span className="font-semibold">{sub.statusLabel}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Último Apontamento Registrado:</span>
                <span className="font-semibold">
                  {health.lastEntryDate
                    ? new Date(health.lastEntryDate).toLocaleDateString("pt-BR")
                    : "Nenhum registro"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criada em:</span>
                <span>{new Date(tenant.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onImpersonate}
                className="gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer"
              >
                <LogInIcon className="size-4" />
                Acessar Empresa no Modo Suporte
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Componente: Lembrete de Cobrança WhatsApp
// ---------------------------------------------------------------------
function WhatsAppReminderDialog({
  tenant,
  onClose,
}: {
  tenant: TenantRowData;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const subInfo = getSubscriptionInfo(tenant);

  const formattedMsg =
    `Olá, equipe ${tenant.name}!\n\n` +
    `Aqui é do suporte Sis.Chronos. Lembramos que a mensalidade do seu plano ${
      tenant.plan_tier?.toUpperCase() || "PRO"
    } ${
      subInfo.formattedExpiration
        ? `está com vencimento previsto para ${subInfo.formattedExpiration}.`
        : "está disponível para renovação."
    }\n\n` +
    `Podemos enviar a chave Pix para renovação da assinatura da sua empresa?`;

  const [message, setMessage] = useState(formattedMsg);
  const [copied, setCopied] = useState(false);

  const handleOpenWhatsApp = () => {
    const cleanPhone = phone.replace(/\D/g, "");
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
            Lembrete de Cobrança WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem pronta para o responsável de <strong>{tenant.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Field
            label="Número de WhatsApp com DDD"
            htmlFor="whatsappPhone"
            hint="Opcional. Se vazio, você escolhe o contato no WhatsApp Web."
          >
            <Input
              id="whatsappPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 11999998888"
            />
          </Field>

          <Field label="Mensagem Formatada" htmlFor="whatsappMessage">
            <Textarea
              id="whatsappMessage"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs font-sans leading-relaxed"
            />
          </Field>

          <div className="flex justify-between items-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 cursor-pointer"
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
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
                onClick={handleOpenWhatsApp}
              >
                <MessageCircleIcon className="size-4" />
                Abrir WhatsApp Web
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Componente: Modal de Edição de Assinatura & MRR Customizado
// ---------------------------------------------------------------------
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

  const customMrr = extractCustomMrr(tenant.manual_notes);
  const cleanedNotes = (tenant.manual_notes ?? "")
    .replace(/\[MRR:\s*\d+(?:[.,]\d+)?\]/gi, "")
    .trim();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-6 sm:p-7 gap-5 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 pb-1">
          <DialogTitle className="text-lg">Editar Assinatura · {tenant.name}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Ajuste plano, mensalidade negociada, datas de vencimento e limite de usuários.
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
                <option value="starter">Starter (R$ 97)</option>
                <option value="pro">Pro (R$ 197)</option>
                <option value="enterprise">Enterprise (R$ 397)</option>
              </NativeSelect>
            </Field>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field
              label="Vencimento"
              htmlFor="currentPeriodEnd"
              hint="Vazio = sem limite."
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
              label="Limite Usuários"
              htmlFor="maxUsers"
              hint="Vazio = ilimitado."
              errors={state.fieldErrors?.maxUsers}
            >
              <Input
                id="maxUsers"
                name="maxUsers"
                type="number"
                min="1"
                placeholder="Ex: 10"
                defaultValue={tenant.max_users ?? ""}
              />
            </Field>

            <Field
              label="Mensalidade R$"
              htmlFor="customMrr"
              hint="Vazio = valor do plano."
              errors={state.fieldErrors?.customMrr}
            >
              <Input
                id="customMrr"
                name="customMrr"
                type="text"
                placeholder="Ex: 250,00"
                defaultValue={customMrr ? String(customMrr) : ""}
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
              defaultValue={cleanedNotes}
              placeholder="Ex: Mensalidade negociada com pagamento via Pix no dia 10."
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
