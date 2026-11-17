"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { BarChart3Icon, ClockIcon, TrendingDownIcon, UsersIcon } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { ClientHoursView } from "./client-hours-view";
import type { ClientHoursReport } from "@/lib/server/metrics.types";

export type DashboardTab = "rentabilidade" | "equipe" | "horas-cliente" | "churn";

export function DashboardViewTabs({
  overviewContent,
  teamContent,
  churnContent,
  clientHoursReport,
  canSeeCosts,
  initialTab = "rentabilidade",
  initialClientId,
}: {
  overviewContent: React.ReactNode;
  teamContent: React.ReactNode;
  churnContent?: React.ReactNode;
  clientHoursReport: ClientHoursReport;
  canSeeCosts: boolean;
  initialTab?: DashboardTab;
  initialClientId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [selectedClientId] = useState<string | undefined>(initialClientId);

  const handleTabChange = useCallback(
    (tab: DashboardTab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "rentabilidade") {
        params.delete("aba");
        params.delete("cliente");
      } else {
        params.set("aba", tab);
        if (tab !== "horas-cliente") {
          params.delete("cliente");
        } else if (selectedClientId) {
          params.set("cliente", selectedClientId);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, selectedClientId],
  );

  const tooltipByTab: Record<DashboardTab, string> = {
    rentabilidade: "Métricas financeiras, margem, reajustes e saúde por contrato.",
    equipe: "Ocupação, utilização, média diária e distribuição de horas/custos da equipe.",
    "horas-cliente": "Consolidação mensal e extrato detalhado de apontamentos por cliente.",
    churn: "Análise de evasão, receita perdida (MRR) e histórico de contratos encerrados.",
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground shadow-xs">
          <button
            type="button"
            onClick={() => handleTabChange("rentabilidade")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
              activeTab === "rentabilidade"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3Icon className="size-4" />
            {canSeeCosts ? "Contratos & Margem" : "Visão Geral"}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("equipe")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
              activeTab === "equipe"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UsersIcon className="size-4" />
            Equipe & Produtividade
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("horas-cliente")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
              activeTab === "horas-cliente"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClockIcon className="size-4" />
            Horas por Cliente
          </button>

          {churnContent ? (
            <button
              type="button"
              onClick={() => handleTabChange("churn")}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                activeTab === "churn"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingDownIcon className="size-4" />
              Churn & Encerrados
            </button>
          ) : null}
        </div>

        <InfoTooltip side="left" text={tooltipByTab[activeTab]} />
      </div>

      <div className={activeTab === "rentabilidade" ? "grid gap-6" : "hidden"}>
        {overviewContent}
      </div>

      <div className={activeTab === "equipe" ? "grid gap-6" : "hidden"}>
        {teamContent}
      </div>

      <div className={activeTab === "horas-cliente" ? "grid gap-6" : "hidden"}>
        <ClientHoursView
          report={clientHoursReport}
          canSeeCosts={canSeeCosts}
          initialClientId={selectedClientId}
        />
      </div>

      {churnContent ? (
        <div className={activeTab === "churn" ? "grid gap-6" : "hidden"}>
          {churnContent}
        </div>
      ) : null}
    </div>
  );
}
