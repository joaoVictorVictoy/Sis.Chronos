"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  BriefcaseIcon,
  Building2Icon,
  ChartLineIcon,
  CheckCheckIcon,
  ClockIcon,
  CreditCardIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  LockIcon,
  ShieldCheckIcon,
  UsersIcon,
  UserCogIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
  soon?: boolean;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Operação",
    items: [
      { href: "/inicio", label: "Início", icon: LayoutDashboardIcon, roles: ["admin", "gestor", "colaborador"] },
      { href: "/apontamentos", label: "Apontamentos", icon: ClockIcon, roles: ["admin", "gestor", "colaborador"] },
      {
        href: "/minhas-analises",
        label: "Minhas análises",
        icon: ChartLineIcon,
        roles: ["admin", "gestor", "colaborador"],
      },
      { href: "/aprovacoes", label: "Aprovações", icon: CheckCheckIcon, roles: ["admin", "gestor"] },
      { href: "/dashboard", label: "Rentabilidade", icon: BarChart3Icon, roles: ["admin", "gestor"] },
    ],
  },
  {
    group: "Cadastros",
    items: [
      { href: "/clientes", label: "Clientes e contratos", icon: BriefcaseIcon, roles: ["admin", "gestor"] },
      { href: "/colaboradores", label: "Colaboradores", icon: UsersIcon, roles: ["admin", "gestor"] },
      { href: "/cadastros/areas", label: "Áreas de atuação", icon: LayersIcon, roles: ["admin", "gestor"] },
      { href: "/cadastros/atividades", label: "Atividades", icon: ListChecksIcon, roles: ["admin", "gestor", "colaborador"] },
    ],
  },
  {
    group: "Configurações",
    items: [
      { href: "/configuracoes/empresa", label: "Empresa", icon: Building2Icon, roles: ["admin"] },
      { href: "/configuracoes/fechamento", label: "Fechamento de período", icon: LockIcon, roles: ["admin"] },
      { href: "/configuracoes/usuarios", label: "Usuários e acessos", icon: UserCogIcon, roles: ["admin"] },
      { href: "/configuracoes/assinatura", label: "Assinatura e plano", icon: CreditCardIcon, roles: ["admin"] },
    ],
  },
];

export function AppNav({
  role,
  isSuperAdmin = false,
  pendingApprovalsCount = 0,
  onNavigate,
}: {
  role: AppRole;
  isSuperAdmin?: boolean;
  pendingApprovalsCount?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const sections = [...NAV];
  if (isSuperAdmin) {
    sections.push({
      group: "Gestão SaaS",
      items: [
        {
          href: "/super-admin",
          label: "Empresas & Assinaturas",
          icon: ShieldCheckIcon,
          roles: ["admin", "gestor", "colaborador"],
        },
      ],
    });
  }

  return (
    <nav className="grid gap-3.5 text-sm">
      {sections.map((section) => {
        const items = section.items
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            if (item.href === "/clientes") {
              return { ...item, label: role === "admin" ? "Clientes e contratos" : "Clientes" };
            }
            return item;
          });
        if (!items.length) return null;
        return (
          <div key={section.group} className="grid gap-1">
            <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.group}</p>
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              if (item.soon) {
                return (
                  <span
                    key={item.href}
                    className="flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground/60"
                    title="Disponível em breve"
                  >
                    <Icon className="size-4" />
                    {item.label}
                    <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px]">em breve</span>
                  </span>
                );
              }

              const isApprovals = item.href === "/aprovacoes";
              const hasApprovalPending = isApprovals && pendingApprovalsCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted group",
                    active && "bg-muted font-medium text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>

                  {hasApprovalPending && (
                    <span
                      className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0 shadow-2xs"
                      title={`${pendingApprovalsCount} apontamento(s) pendente(s) de aprovação`}
                    >
                      <ClockIcon className="size-3 text-amber-500 animate-pulse shrink-0" />
                      <span>{pendingApprovalsCount > 99 ? "99+" : pendingApprovalsCount}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
