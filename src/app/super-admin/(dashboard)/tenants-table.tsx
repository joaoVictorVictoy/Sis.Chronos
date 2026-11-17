"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BanIcon,
  CalendarCheck2Icon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  Edit3Icon,
  HeartPulseIcon,
  KeyRoundIcon,
  LogInIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  TrendingUpIcon,
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
  renewSubscriptionAction,
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
  canViewCosts: boolean;
  active: boolean;
  createdAt: string;
};

export type TenantHealthStatus = "engaged" | "low_activity" | "inactive";

export type TenantRowData = Tables<"tenants"> & {
  membersCount: number;
  users: TenantMember[];
  primaryAdmin: TenantMember | null;
  recentEntries30d: number;
  recentHours30d: number;
  lastEntryDate: string | null;
  healthStatus: TenantHealthStatus;
};

type FilterStatus =
  | "all"
  | "active"
  | "trialing"
  | "expiring_soon"
  | "churn_risk"
  | "suspended";

type SortOption =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "expiring_asc"
  | "mrr_desc"
  | "users_desc"
  | "usage_desc"
  | "stale_asc";

function normalizeMemberRole(role: string): "admin" | "gestor" | "colaborador" {
  if (role === "admin") return "admin";
  if (role === "gestor" || role === "manager") return "gestor";
  return "colaborador";
}

function formatDateBr(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const datePart = isoDate.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return new Date(isoDate).toLocaleDateString("pt-BR");
  return `${d}/${m}/${y}`;
}

function isChurnRiskTenant(t: TenantRowData): boolean {
  const isOperational =
    t.subscription_status === "manual_active" ||
    t.subscription_status === "active" ||
    t.subscription_status === "trialing";
  return isOperational && t.healthStatus !== "engaged";
}

export function TenantsTable({ tenants }: { tenants: TenantRowData[] }) {
  const [selectedTenant, setSelectedTenant] = useState<TenantRowData | null>(null);
  const [whatsAppTenant, setWhatsAppTenant] = useState<TenantRowData | null>(null);
  const [viewUsersTenant, setViewUsersTenant] = useState<TenantRowData | null>(null);
  const [healthTenant, setHealthTenant] = useState<TenantRowData | null>(null);

  // Modais padronizados (substituem confirm/prompt/alert nativos)
  const [confirmToggleTenant, setConfirmToggleTenant] = useState<TenantRowData | null>(null);
  const [confirmTrialState, setConfirmTrialState] = useState<{
    tenant: TenantRowData;
    days: number;
  } | null>(null);
  const [confirmRenewState, setConfirmRenewState] = useState<{
    tenant: TenantRowData;
    days: number;
  } | null>(null);
  const [maxUsersTenant, setMaxUsersTenant] = useState<TenantRowData | null>(null);
  const [deleteTenantTarget, setDeleteTenantTarget] = useState<TenantRowData | null>(null);

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
    churn_risk: tenants.filter(isChurnRiskTenant).length,
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

    if (statusFilter === "churn_risk") {
      return isChurnRiskTenant(t);
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
    if (sortBy === "usage_desc") return b.recentHours30d - a.recentHours30d;
    if (sortBy === "stale_asc") {
      const dateA = a.lastEntryDate ?? "0000-00-00";
      const dateB = b.lastEntryDate ?? "0000-00-00";
      return dateA.localeCompare(dateB);
    }
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
        toast.error(msg);
      }
    });
  };

  const executeToggleStatus = (tenant: TenantRowData) => {
    const wasSuspended = tenant.subscription_status === "suspended";
    startTransition(async () => {
      try {
        await toggleTenantStatusAction(tenant.id, tenant.subscription_status);
        toast.success(
          wasSuspended
            ? `Empresa "${tenant.name}" reativada com sucesso.`
            : `Empresa "${tenant.name}" suspensa.`
        );
        setConfirmToggleTenant(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar status.");
      }
    });
  };

  const executeExtendTrial = (tenant: TenantRowData, days: number) => {
    startTransition(async () => {
      try {
        await extendTrialAction(tenant.id, days);
        toast.success(`Teste de "${tenant.name}" prorrogado por +${days} dias.`);
        setConfirmTrialState(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao prorrogar teste.");
      }
    });
  };

  const executeRenewSubscription = (tenant: TenantRowData, days: number) => {
    startTransition(async () => {
      try {
        const res = await renewSubscriptionAction(tenant.id, days);
        const formattedEnd = formatDateBr(res.newPeriodEnd);
        toast.success(
          `Assinatura de "${tenant.name}" renovada (+${days}d). Novo vencimento: ${formattedEnd}.`
        );
        setConfirmRenewState(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao renovar assinatura.");
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
      "Engajamento",
      "Horas (30d)",
      "Último Apontamento",
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
      const healthLabel =
        t.healthStatus === "engaged"
          ? "Engajada"
          : t.healthStatus === "low_activity"
          ? "Baixo Uso"
          : "Sem Uso";
      return [
        `"${t.name.replace(/"/g, '""')}"`,
        `"${t.cnpj ?? ""}"`,
        `"${t.email_domain ?? ""}"`,
        `"${sub.statusLabel}"`,
        `"${healthLabel}"`,
        t.recentHours30d.toFixed(1),
        `"${formatDateBr(t.lastEntryDate) ?? "Nenhum"}"`,
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
            variant={statusFilter === "churn_risk" ? "default" : "outline"}
            onClick={() => setStatusFilter("churn_risk")}
            className="h-8 text-xs text-orange-600 dark:text-orange-400 border-orange-500/30 cursor-pointer"
            title="Empresas ativas ou em teste há mais de 7 dias sem apontamentos"
          >
            Risco de Churn ({counts.churn_risk})
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
              className="h-8 text-xs w-[180px]"
            >
              <option value="newest">Mais Recentes</option>
              <option value="name_asc">Nome (A - Z)</option>
              <option value="name_desc">Nome (Z - A)</option>
              <option value="expiring_asc">Próximo a Vencer</option>
              <option value="mrr_desc">Maior MRR</option>
              <option value="users_desc">Mais Usuários</option>
              <option value="usage_desc">Maior Uso (30d)</option>
              <option value="stale_asc">Mais Tempo Sem Uso</option>
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
                <th className="p-3.5">Engajamento (30d)</th>
                <th className="p-3.5">Plano & Receita</th>
                <th className="p-3.5">Vencimento</th>
                <th className="p-3.5 text-center">Usuários & Vagas</th>
                <th className="p-3.5">Notas Internas</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sortedTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">
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

                  const adminCount = t.users.filter(
                    (u) => u.active && normalizeMemberRole(u.role) === "admin"
                  ).length;
                  const gestorCount = t.users.filter(
                    (u) => u.active && normalizeMemberRole(u.role) === "gestor"
                  ).length;
                  const colabCount = t.users.filter(
                    (u) => u.active && normalizeMemberRole(u.role) === "colaborador"
                  ).length;
                  const roleParts: string[] = [];
                  if (adminCount > 0) roleParts.push(`${adminCount} adm`);
                  if (gestorCount > 0) roleParts.push(`${gestorCount} gest`);
                  if (colabCount > 0) roleParts.push(`${colabCount} colab`);

                  const usagePct =
                    t.max_users && t.max_users > 0
                      ? Math.min(100, Math.round((t.membersCount / t.max_users) * 100))
                      : 0;
                  const isNearLimit = Boolean(t.max_users && usagePct >= 80 && t.membersCount < t.max_users);
                  const isAtLimit = Boolean(t.max_users && t.membersCount >= t.max_users);
                  const lastEntryBr = formatDateBr(t.lastEntryDate);

                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      {/* Empresa e Administrador Principal */}
                      <td className="p-3.5 min-w-[230px]">
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
                            <span
                              className="font-medium text-foreground truncate max-w-[120px]"
                              title={t.primaryAdmin.fullName}
                            >
                              {t.primaryAdmin.fullName}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span
                              className="text-muted-foreground truncate max-w-[150px]"
                              title={t.primaryAdmin.email}
                            >
                              {t.primaryAdmin.email}
                            </span>
                            <button
                              onClick={() => copyToClipboard(t.primaryAdmin!.email, `mail-${t.id}`)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 cursor-pointer"
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

                      {/* Engajamento (30d) */}
                      <td className="p-3.5 whitespace-nowrap">
                        <button
                          onClick={() => setHealthTenant(t)}
                          className="text-left group cursor-pointer space-y-1"
                          title="Abrir Visão 360° de uso e engajamento"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-block size-2 rounded-full ${
                                t.healthStatus === "engaged"
                                  ? "bg-emerald-500"
                                  : t.healthStatus === "low_activity"
                                  ? "bg-amber-500"
                                  : "bg-destructive"
                              }`}
                            />
                            <span
                              className={`text-xs font-medium group-hover:underline ${
                                t.healthStatus === "engaged"
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : t.healthStatus === "low_activity"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-destructive"
                              }`}
                            >
                              {t.healthStatus === "engaged"
                                ? "Engajada"
                                : t.healthStatus === "low_activity"
                                ? "Baixo Uso"
                                : "Sem Uso"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {t.recentEntries30d > 0 ? (
                              <>
                                <strong className="font-medium text-foreground/80">
                                  {t.recentHours30d}h
                                </strong>{" "}
                                · Último: {lastEntryBr}
                              </>
                            ) : lastEntryBr ? (
                              <>Último: {lastEntryBr}</>
                            ) : (
                              "Sem apontamentos"
                            )}
                          </p>
                        </button>
                      </td>

                      {/* Plano & MRR */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium capitalize text-xs">{t.plan_tier || "Pro"}</p>
                          {customMrr !== null && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 border-indigo-400 text-indigo-600 dark:text-indigo-400"
                            >
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

                      {/* Usuários e Barra de Ocupação de Vagas */}
                      <td className="p-3.5 text-center text-xs whitespace-nowrap">
                        <button
                          onClick={() => setViewUsersTenant(t)}
                          className="flex flex-col items-center justify-center gap-1 mx-auto group cursor-pointer min-w-[110px]"
                          title="Clique para ver os usuários cadastrados (admins, gestores e colaboradores)"
                        >
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                            <span>{t.membersCount}</span>
                            {t.max_users ? ` / ${t.max_users}` : ""}
                            <UsersIcon className="size-3 opacity-50 group-hover:opacity-100" />
                          </span>

                          {t.max_users ? (
                            <>
                              <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    isAtLimit
                                      ? "bg-destructive"
                                      : isNearLimit
                                      ? "bg-amber-500"
                                      : "bg-primary"
                                  }`}
                                  style={{ width: `${usagePct}%` }}
                                />
                              </div>
                              {isAtLimit ? (
                                <span className="text-[10px] text-destructive font-medium bg-destructive/10 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                                  <TrendingUpIcon className="size-2.5" />
                                  Limite · Upsell
                                </span>
                              ) : isNearLimit ? (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  {usagePct}% ocupado
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  {t.max_users - t.membersCount}{" "}
                                  {t.max_users - t.membersCount === 1 ? "vaga" : "vagas"}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">ilimitado</span>
                          )}

                          {roleParts.length > 0 && (
                            <span className="text-[10px] text-muted-foreground/80">
                              {roleParts.join(" · ")}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Notas */}
                      <td
                        className="p-3.5 max-w-[170px] truncate text-xs text-muted-foreground"
                        title={t.manual_notes ?? ""}
                      >
                        {t.manual_notes ? (
                          t.manual_notes.replace(/\[MRR:\s*\d+(?:[.,]\d+)?\]/gi, "").trim() || (
                            <span className="opacity-40">-</span>
                          )
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
                            onClick={() => setConfirmToggleTenant(t)}
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
                            <DropdownMenuContent align="end" className="w-60">
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
                                onClick={() => setMaxUsersTenant(t)}
                                className="cursor-pointer font-medium text-primary"
                              >
                                <UsersIcon className="mr-2 size-4 text-primary" />
                                Limite de Vagas ({t.max_users ? `${t.max_users} máx` : "Ilimitado"})
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                Renovação Rápida (Ativa)
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setConfirmRenewState({ tenant: t, days: 30 })}
                                className="cursor-pointer text-emerald-600 dark:text-emerald-400"
                              >
                                <CalendarCheck2Icon className="mr-2 size-4" />
                                Renovar +30 dias
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setConfirmRenewState({ tenant: t, days: 365 })}
                                className="cursor-pointer text-emerald-600 dark:text-emerald-400"
                              >
                                <CalendarCheck2Icon className="mr-2 size-4" />
                                Renovar +1 ano (365d)
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                Prorrogar Teste
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setConfirmTrialState({ tenant: t, days: 7 })}
                                className="cursor-pointer"
                              >
                                <SparklesIcon className="mr-2 size-4 text-amber-500" />
                                +7 dias grátis
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setConfirmTrialState({ tenant: t, days: 14 })}
                                className="cursor-pointer"
                              >
                                <SparklesIcon className="mr-2 size-4 text-amber-500" />
                                +14 dias grátis
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setConfirmTrialState({ tenant: t, days: 30 })}
                                className="cursor-pointer"
                              >
                                <SparklesIcon className="mr-2 size-4 text-amber-500" />
                                +30 dias grátis
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTenantTarget(t)}
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
          onDelete={() => setDeleteTenantTarget(selectedTenant)}
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
          key={viewUsersTenant.id}
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
          key={healthTenant.id}
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

      {/* Dialog: Suspender / Reativar Empresa */}
      {confirmToggleTenant && (
        <ConfirmToggleStatusDialog
          tenant={confirmToggleTenant}
          pending={isPending}
          onConfirm={() => executeToggleStatus(confirmToggleTenant)}
          onClose={() => setConfirmToggleTenant(null)}
        />
      )}

      {/* Dialog: Prorrogar Teste (Trial) */}
      {confirmTrialState && (
        <ConfirmExtendTrialDialog
          tenant={confirmTrialState.tenant}
          days={confirmTrialState.days}
          pending={isPending}
          onConfirm={() => executeExtendTrial(confirmTrialState.tenant, confirmTrialState.days)}
          onClose={() => setConfirmTrialState(null)}
        />
      )}

      {/* Dialog: Renovar Assinatura */}
      {confirmRenewState && (
        <ConfirmRenewDialog
          tenant={confirmRenewState.tenant}
          days={confirmRenewState.days}
          pending={isPending}
          onConfirm={() =>
            executeRenewSubscription(confirmRenewState.tenant, confirmRenewState.days)
          }
          onClose={() => setConfirmRenewState(null)}
        />
      )}

      {/* Dialog: Alterar Limite de Vagas */}
      {maxUsersTenant && (
        <MaxUsersDialog
          tenant={maxUsersTenant}
          onClose={() => setMaxUsersTenant(null)}
        />
      )}

      {/* Dialog: Excluir Empresa */}
      {deleteTenantTarget && (
        <DeleteTenantDialog
          tenant={deleteTenantTarget}
          onClose={() => setDeleteTenantTarget(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Componente: Visualizador de Usuários da Empresa (com Gestores, Admins e Colaboradores)
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
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "gestor" | "colaborador">("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [memberSearch, setMemberSearch] = useState("");

  const roleCounts = useMemo(() => {
    let admin = 0;
    let gestor = 0;
    let colaborador = 0;
    let inactive = 0;
    for (const u of tenant.users) {
      const nr = normalizeMemberRole(u.role);
      if (nr === "admin") admin++;
      else if (nr === "gestor") gestor++;
      else colaborador++;
      if (!u.active) inactive++;
    }
    return { admin, gestor, colaborador, inactive };
  }, [tenant.users]);

  const filteredUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return tenant.users.filter((u) => {
      const nr = normalizeMemberRole(u.role);
      if (roleFilter !== "all" && nr !== roleFilter) return false;
      if (activeFilter === "active" && !u.active) return false;
      if (activeFilter === "inactive" && u.active) return false;
      if (q && !u.fullName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [tenant.users, roleFilter, activeFilter, memberSearch]);

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[85vh] p-6 flex flex-col gap-3.5">
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

        {/* Resumo e filtros por cargo / status */}
        {tenant.users.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={roleFilter === "all" ? "default" : "outline"}
                onClick={() => setRoleFilter("all")}
                className="h-7 px-2.5 text-xs cursor-pointer"
              >
                Todos ({tenant.users.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={roleFilter === "admin" ? "default" : "outline"}
                onClick={() => setRoleFilter("admin")}
                className="h-7 px-2.5 text-xs cursor-pointer"
              >
                Admins ({roleCounts.admin})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={roleFilter === "gestor" ? "default" : "outline"}
                onClick={() => setRoleFilter("gestor")}
                className="h-7 px-2.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 cursor-pointer"
              >
                Gestores ({roleCounts.gestor})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={roleFilter === "colaborador" ? "default" : "outline"}
                onClick={() => setRoleFilter("colaborador")}
                className="h-7 px-2.5 text-xs cursor-pointer"
              >
                Colaboradores ({roleCounts.colaborador})
              </Button>

              {roleCounts.inactive > 0 && (
                <div className="ml-auto flex items-center gap-1">
                  <NativeSelect
                    aria-label="Filtrar por status do usuário"
                    value={activeFilter}
                    onChange={(e) =>
                      setActiveFilter(e.target.value as "all" | "active" | "inactive")
                    }
                    className="h-7 text-xs w-[125px]"
                  >
                    <option value="all">Ativos e Inativos</option>
                    <option value="active">Somente Ativos</option>
                    <option value="inactive">Inativos ({roleCounts.inactive})</option>
                  </NativeSelect>
                </div>
              )}
            </div>

            {tenant.users.length > 6 && (
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome ou e-mail..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 pt-1 max-h-[50vh]">
          {tenant.users.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Nenhum usuário com login registrado nesta empresa.
            </p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Nenhum usuário encontrado com esse filtro.
            </p>
          ) : (
            filteredUsers.map((u) => {
              const nr = normalizeMemberRole(u.role);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-4 p-3.5 rounded-xl border bg-card/60 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className="font-semibold text-sm text-foreground truncate max-w-[200px]"
                        title={u.fullName}
                      >
                        {u.fullName}
                      </p>
                      {nr === "admin" ? (
                        <Badge variant="default" className="text-[10px] px-2 py-0.5 shrink-0">
                          Administrador
                        </Badge>
                      ) : nr === "gestor" ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 shrink-0 border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        >
                          Gestor
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 shrink-0">
                          Colaborador
                        </Badge>
                      )}
                      {nr === "gestor" && u.canViewCosts && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.5 shrink-0 text-muted-foreground"
                        >
                          Vê custos
                        </Badge>
                      )}
                      {!u.active && (
                        <Badge variant="destructive" className="text-[10px] px-2 py-0.5 shrink-0">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate max-w-[240px] sm:max-w-sm" title={u.email}>
                        {u.email}
                      </span>
                      <button
                        onClick={() => copyEmail(u.email)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted shrink-0 cursor-pointer"
                        title="Copiar e-mail"
                      >
                        {copiedEmail === u.email ? (
                          <CheckIcon className="size-3.5 text-emerald-500" />
                        ) : (
                          <CopyIcon className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 shrink-0 cursor-pointer ml-2"
                    onClick={() => onGenerateAccessLink(u.email)}
                    title="Gerar link mágico de login sem necessidade de senha"
                  >
                    <KeyRoundIcon className="size-3.5" />
                    <span className="whitespace-nowrap">Link de Login</span>
                  </Button>
                </div>
              );
            })
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
      <DialogContent className="sm:max-w-lg p-6 flex flex-col gap-4">
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

  useEffect(() => {
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
  }, [tenant.id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] p-6 overflow-y-auto">
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
                  {formatDateBr(health.lastEntryDate) ?? "Nenhum registro"}
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
// Modais Padronizados de Confirmação & Ações Rápidas
// ---------------------------------------------------------------------
function ConfirmToggleStatusDialog({
  tenant,
  pending,
  onConfirm,
  onClose,
}: {
  tenant: TenantRowData;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isSuspended = tenant.subscription_status === "suspended";

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuspended ? (
              <PlayIcon className="size-5 text-emerald-600" />
            ) : (
              <BanIcon className="size-5 text-destructive" />
            )}
            {isSuspended ? `Reativar ${tenant.name}?` : `Suspender ${tenant.name}?`}
          </DialogTitle>
          <DialogDescription>
            {isSuspended
              ? `Os usuários da empresa "${tenant.name}" voltarão a ter acesso normal ao workspace.`
              : `O acesso da empresa "${tenant.name}" será bloqueado imediatamente. Os usuários verão uma tela orientando a contatar o administrador.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant={isSuspended ? "default" : "destructive"}
            className={isSuspended ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending
              ? "Processando..."
              : isSuspended
              ? "Confirmar Reativação"
              : "Confirmar Suspensão"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmExtendTrialDialog({
  tenant,
  days,
  pending,
  onConfirm,
  onClose,
}: {
  tenant: TenantRowData;
  days: number;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-amber-500" />
            Prorrogar Teste (+{days} dias)
          </DialogTitle>
          <DialogDescription>
            Deseja prorrogar o período de avaliação gratuita da empresa{" "}
            <strong>{tenant.name}</strong> por mais <strong>{days} dias</strong> a partir de hoje?
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={pending}>
            {pending ? "Prorrogando..." : `Adicionar +${days} dias`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmRenewDialog({
  tenant,
  days,
  pending,
  onConfirm,
  onClose,
}: {
  tenant: TenantRowData;
  days: number;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [nowMs] = useState(() => Date.now());
  const currentEndMs = tenant.current_period_end
    ? new Date(tenant.current_period_end).getTime()
    : 0;
  const baseMs = Math.max(nowMs, Number.isFinite(currentEndMs) ? currentEndMs : 0);
  const previewDate = new Date(baseMs + days * 86400000).toLocaleDateString("pt-BR");

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2Icon className="size-5 text-emerald-600" />
            Renovar Assinatura (+{days === 365 ? "1 ano" : `${days} dias`})
          </DialogTitle>
          <DialogDescription>
            A assinatura de <strong>{tenant.name}</strong> será marcada como{" "}
            <strong>Ativa (Manual)</strong> e terá o vencimento estendido para{" "}
            <strong>{previewDate}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Renovando..." : "Confirmar Renovação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MaxUsersDialog({
  tenant,
  onClose,
}: {
  tenant: TenantRowData;
  onClose: () => void;
}) {
  const [value, setValue] = useState<string>(tenant.max_users ? String(tenant.max_users) : "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitLimit = (nextLimit: number | null) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await updateTenantMaxUsersAction(tenant.id, nextLimit);
        toast.success(
          nextLimit
            ? `Limite de "${tenant.name}" atualizado para ${nextLimit} usuários.`
            : `Limite de "${tenant.name}" liberado (Ilimitado).`
        );
        onClose();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erro ao atualizar limite.");
      }
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "0") {
      submitLimit(null);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setErrorMsg("Informe um número inteiro positivo (ex: 5, 10) ou deixe vazio para ilimitado.");
      return;
    }
    submitLimit(parsed);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersIcon className="size-5 text-primary" />
            Limite de Vagas · {tenant.name}
          </DialogTitle>
          <DialogDescription>
            Usuários registrados atualmente: <strong>{tenant.membersCount}</strong>. Deixe o campo
            vazio ou clique em &ldquo;Ilimitado&rdquo; para remover o teto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          <Field
            label="Quantidade máxima de usuários"
            htmlFor="quickMaxUsersInput"
            hint="Vazio ou 0 = sem limite de vagas."
          >
            <Input
              id="quickMaxUsersInput"
              type="number"
              min="0"
              placeholder="Ex: 10"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </Field>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => submitLimit(null)}
              disabled={pending}
            >
              Definir Ilimitado
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Salvando..." : "Salvar Limite"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTenantDialog({
  tenant,
  onClose,
}: {
  tenant: TenantRowData;
  onClose: () => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = confirmName.trim().toLowerCase() === tenant.name.trim().toLowerCase();

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matches) return;
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await deleteTenantAction(tenant.id);
        toast.success(`Empresa "${tenant.name}" excluída definitivamente.`);
        onClose();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Erro ao excluir empresa.");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2Icon className="size-5" />
            Excluir Empresa Definitivamente
          </DialogTitle>
          <DialogDescription>
            Ação irreversível! Todos os dados de <strong>{tenant.name}</strong> (contratos,
            clientes, colaboradores, apontamentos e logins) serão excluídos permanentemente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete} className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          <Field
            label={`Digite "${tenant.name}" para confirmar`}
            htmlFor="deleteTenantConfirmInput"
          >
            <Input
              id="deleteTenantConfirmInput"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={tenant.name}
              autoFocus
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={!matches || pending}
            >
              {pending ? "Excluindo..." : "Excluir Definitivamente"}
            </Button>
          </div>
        </form>
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
