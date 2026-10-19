"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { BarChart3Icon, ClockIcon } from "lucide-react";
import { ClientHoursView } from "./client-hours-view";
import type { ClientHoursReport } from "@/lib/server/metrics.types";

export function DashboardViewTabs({
  overviewContent,
  clientHoursReport,
  canSeeCosts,
  initialTab = "rentabilidade",
  initialClientId,
}: {
  overviewContent: React.ReactNode;
  clientHoursReport: ClientHoursReport;
  canSeeCosts: boolean;
  initialTab?: "rentabilidade" | "horas-cliente";
  initialClientId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"rentabilidade" | "horas-cliente">(initialTab);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(initialClientId);

  const handleTabChange = useCallback(
    (tab: "rentabilidade" | "horas-cliente") => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "horas-cliente") {
        params.set("aba", "horas-cliente");
        if (selectedClientId) params.set("cliente", selectedClientId);
      } else {
        params.delete("aba");
        params.delete("cliente");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, selectedClientId],
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground shadow-xs">
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
            Rentabilidade & Visão Geral
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
        </div>

        <p className="text-xs text-muted-foreground">
          {activeTab === "rentabilidade"
            ? "Métricas financeiras, margem e rentabilidade por contrato."
            : "Consolidação mensal e extrato detalhado de apontamentos por cliente."}
        </p>
      </div>

      <div className={activeTab === "rentabilidade" ? "grid gap-6" : "hidden"}>
        {overviewContent}
      </div>

      <div className={activeTab === "horas-cliente" ? "grid gap-6" : "hidden"}>
        <ClientHoursView
          report={clientHoursReport}
          canSeeCosts={canSeeCosts}
          initialClientId={selectedClientId}
        />
      </div>
    </div>
  );
}
