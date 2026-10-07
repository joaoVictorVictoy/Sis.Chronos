"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ActivityIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  FlameIcon,
  PalmtreeIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { formatHours, formatPercent } from "@/lib/format";
import { addDays } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildDayHeatmapMap,
  buildHeatmapWeeks,
  calculateHeatmapKpis,
  type DayHeatmapData,
  type HeatmapRawEntry,
  type HeatmapRawLeave,
} from "@/lib/heatmap";

interface ActivityHeatmapProps {
  entries: HeatmapRawEntry[];
  leaves: HeatmapRawLeave[];
  today: string;
  monthlyHours: number;
}

type PeriodPreset = "7d" | "30d" | "90d" | "all";
type TabView = "overview" | "clients";

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function ActivityHeatmap({
  entries,
  leaves,
  today,
  monthlyHours,
}: ActivityHeatmapProps) {
  const [preset, setPreset] = useState<PeriodPreset>("90d");
  const [tabView, setTabView] = useState<TabView>("overview");
  const [hoveredDay, setHoveredDay] = useState<{
    data: DayHeatmapData;
    rect: DOMRect;
  } | null>(null);

  // Calcula a data inicial do filtro
  const fromDate = useMemo(() => {
    switch (preset) {
      case "7d":
        return addDays(today, -6);
      case "30d":
        return addDays(today, -29);
      case "90d":
        return addDays(today, -89);
      case "all":
        return addDays(today, -150); // ~5 meses de histórico compacto
    }
  }, [preset, today]);

  // Mapa de dias e semanas
  const { dayMap, weeks, kpis } = useMemo(() => {
    const map = buildDayHeatmapMap(entries, leaves, fromDate, today);
    const w = buildHeatmapWeeks(map, fromDate, today);
    const k = calculateHeatmapKpis(map, entries, fromDate, today);
    return { dayMap: map, weeks: w, kpis: k };
  }, [entries, leaves, fromDate, today]);

  // Ranking geral de clientes no período selecionado (para aba Clientes)
  const clientRanking = useMemo(() => {
    const map = new Map<string, { hours: number; billableHours: number }>();
    for (const e of entries) {
      if (e.entry_date < fromDate || e.entry_date > today) continue;
      const client = e.client_name?.trim() || "Interno / Sem cliente";
      const curr = map.get(client) || { hours: 0, billableHours: 0 };
      curr.hours += Number(e.hours);
      if (e.billable) curr.billableHours += Number(e.hours);
      map.set(client, curr);
    }
    return [...map.entries()]
      .map(([name, stats]) => ({
        name,
        hours: stats.hours,
        billableHours: stats.billableHours,
        share: kpis.totalHours > 0 ? (stats.hours / kpis.totalHours) * 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [entries, fromDate, today, kpis.totalHours]);

  const formatDateTitle = (iso: string) => {
    try {
      const d = parseISO(iso);
      return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return iso;
    }
  };

  return (
    <Card className="overflow-hidden border border-border/80 shadow-sm transition-all">
      {/* Cabeçalho estilo Claude / GitHub do print */}
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setTabView("overview")}
              className={`rounded-md px-3 py-1 transition-all ${
                tabView === "overview"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Visão Geral
            </button>
            <button
              type="button"
              onClick={() => setTabView("clients")}
              className={`rounded-md px-3 py-1 transition-all ${
                tabView === "clients"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Por Cliente ({clientRanking.length})
            </button>
          </div>
        </div>

        {/* Seletor de período idêntico ao print: All, 90d, 30d, 7d */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setPreset("all")}
            className={`rounded-md px-2.5 py-0.5 transition-all ${
              preset === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setPreset("90d")}
            className={`rounded-md px-2.5 py-0.5 transition-all ${
              preset === "90d"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            90d
          </button>
          <button
            type="button"
            onClick={() => setPreset("30d")}
            className={`rounded-md px-2.5 py-0.5 transition-all ${
              preset === "30d"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            30d
          </button>
          <button
            type="button"
            onClick={() => setPreset("7d")}
            className={`rounded-md px-2.5 py-0.5 transition-all ${
              preset === "7d"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7d
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Painel de KPIs idêntico ao layout do print */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <span className="text-xs text-muted-foreground font-medium block">Dias Apontados</span>
            <span className="text-2xl font-bold tracking-tight text-foreground block mt-1">
              {kpis.activeDays}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              de {kpis.businessDaysCount} dias úteis
            </span>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <span className="text-xs text-muted-foreground font-medium block">Total de Horas</span>
            <span className="text-2xl font-bold tracking-tight text-foreground block mt-1">
              {formatHours(kpis.totalHours)}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              no período selecionado
            </span>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <span className="text-xs text-muted-foreground font-medium block">Média por Dia Ativo</span>
            <span className="text-2xl font-bold tracking-tight text-foreground block mt-1">
              {formatHours(kpis.averageDailyHours)}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              nas datas com horas
            </span>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-3 col-span-2 sm:col-span-1">
            <span className="text-xs text-muted-foreground font-medium block truncate">Principal Cliente</span>
            <span className="text-lg font-bold tracking-tight text-foreground block mt-1 truncate" title={kpis.topClient?.name || "Nenhum"}>
              {kpis.topClient ? kpis.topClient.name : "Nenhum"}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {kpis.topClient ? `${formatHours(kpis.topClient.hours)} apontadas` : "—"}
            </span>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-3 col-span-2 sm:col-span-2 lg:col-span-1">
            <span className="text-xs text-muted-foreground font-medium block">Horas Faturáveis</span>
            <span className="text-2xl font-bold tracking-tight text-foreground block mt-1">
              {formatPercent(kpis.billablePercent / 100)}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {formatHours(kpis.billableHours)} faturáveis
            </span>
          </div>
        </div>

        {tabView === "overview" ? (
          /* Grade de Quadradinhos (Heatmap) */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <CalendarDaysIcon className="size-3.5 text-blue-500" />
                Matriz de Apontamentos diários
              </span>
              <span className="text-[11px]">
                Passe o mouse nos quadradinhos para ver as horas e clientes do dia
              </span>
            </div>

            {/* Container com scroll horizontal se necessário para caber em telas menores */}
            <div className="overflow-x-auto pb-2 pt-1">
              <div className="inline-flex gap-1.5 min-w-full justify-start sm:justify-center">
                {/* Legenda dos dias da semana à esquerda (Seg, Qua, Sex) */}
                <div className="grid grid-rows-7 gap-1 text-[10px] text-muted-foreground pr-1 select-none font-medium text-right leading-none">
                  <span className="h-3.5 flex items-center justify-end">Seg</span>
                  <span className="h-3.5 flex items-center justify-end"></span>
                  <span className="h-3.5 flex items-center justify-end">Qua</span>
                  <span className="h-3.5 flex items-center justify-end"></span>
                  <span className="h-3.5 flex items-center justify-end">Sex</span>
                  <span className="h-3.5 flex items-center justify-end"></span>
                  <span className="h-3.5 flex items-center justify-end">Dom</span>
                </div>

                {/* Colunas de Semanas */}
                {weeks.map((week) => (
                  <div key={week.weekIndex} className="grid grid-rows-7 gap-1">
                    {week.days.map((day, dIdx) => {
                      if (!day) {
                        return (
                          <div
                            key={dIdx}
                            className="size-3.5 rounded-[3px] bg-transparent opacity-0 pointer-events-none"
                          />
                        );
                      }

                      // Cores baseadas no nível de horas e status (férias vs normal)
                      let colorClass = "bg-muted/40 hover:ring-2 hover:ring-ring border border-border/20";
                      if (day.isLeave) {
                        colorClass = "bg-amber-500/35 border border-amber-500/50 hover:ring-2 hover:ring-amber-500";
                      } else if (day.level === 1) {
                        colorClass = "bg-sky-200 dark:bg-sky-950/90 border border-sky-400/30 hover:ring-2 hover:ring-sky-400";
                      } else if (day.level === 2) {
                        colorClass = "bg-sky-400 dark:bg-sky-700/90 border border-sky-500/40 hover:ring-2 hover:ring-sky-400";
                      } else if (day.level === 3) {
                        colorClass = "bg-blue-500 dark:bg-blue-600 border border-blue-400/50 hover:ring-2 hover:ring-blue-400";
                      } else if (day.level === 4) {
                        colorClass = "bg-blue-600 dark:bg-blue-400 border border-blue-300/60 shadow-xs shadow-blue-500/30 hover:ring-2 hover:ring-blue-300";
                      }

                      return (
                        <Link
                          key={day.date}
                          href={`/apontamentos?semana=${day.date}`}
                          className={`size-3.5 rounded-[3px] transition-all cursor-pointer ${colorClass}`}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredDay({ data: day, rect });
                          }}
                          onMouseLeave={() => setHoveredDay(null)}
                          title={`${day.date}: ${formatHours(day.totalHours)}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé com legenda e métrica inspiracional do print */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs text-muted-foreground border-t border-border/40">
              <p>
                Você apontou horas em{" "}
                <strong className="text-foreground">{kpis.activeDays}</strong> dos últimos{" "}
                <strong className="text-foreground">{kpis.businessDaysCount} dias úteis</strong>.
              </p>

              {/* Legenda de cores */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span>Menos</span>
                <div className="size-3 rounded-[2px] bg-muted/40 border border-border/20" title="0h" />
                <div className="size-3 rounded-[2px] bg-sky-200 dark:bg-sky-950/90 border border-sky-400/30" title="Até 2h" />
                <div className="size-3 rounded-[2px] bg-sky-400 dark:bg-sky-700/90 border border-sky-500/40" title="Até 5h" />
                <div className="size-3 rounded-[2px] bg-blue-500 dark:bg-blue-600 border border-blue-400/50" title="Até 8h" />
                <div className="size-3 rounded-[2px] bg-blue-600 dark:bg-blue-400 border border-blue-300/60" title="Mais de 8h" />
                <span>Mais</span>
                <span className="mx-1">·</span>
                <div className="flex items-center gap-1">
                  <div className="size-3 rounded-[2px] bg-amber-500/35 border border-amber-500/50" />
                  <span>Férias</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Aba Clientes: detalhamento do período */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Total de horas dedicadas a cada cliente no período selecionado ({preset}):
            </p>
            {clientRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum apontamento com cliente registrado no período selecionado.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {clientRanking.map((c) => (
                  <div key={c.name} className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs">
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-foreground font-semibold">{c.name}</span>
                      <span className="tabular-nums font-bold text-foreground">
                        {formatHours(c.hours)} ({formatPercent(c.share / 100)})
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${Math.min(c.share, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>{formatHours(c.billableHours)} faturáveis</span>
                      <span>{formatHours(c.hours - c.billableHours)} não-faturáveis</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* TOOLTIP FLUTUANTE RICO NO HOVER (A exigência principal do usuário) */}
      {hoveredDay && (
        <div
          className="fixed z-50 pointer-events-none rounded-xl border border-border bg-popover/95 backdrop-blur-md p-3.5 text-popover-foreground shadow-2xl transition-all duration-75 min-w-[240px] max-w-[300px]"
          style={{
            top: Math.max(10, hoveredDay.rect.top - 180),
            left: Math.min(
              window.innerWidth - 320,
              Math.max(10, hoveredDay.rect.left + hoveredDay.rect.width / 2 - 120),
            ),
          }}
        >
          {/* Cabeçalho do Dia */}
          <div className="space-y-1 border-b pb-2">
            <span className="text-xs font-semibold capitalize block text-foreground">
              {formatDateTitle(hoveredDay.data.date)}
            </span>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <ClockIcon className="size-3.5 inline" />
                {hoveredDay.data.totalHours > 0
                  ? `${formatHours(hoveredDay.data.totalHours)} apontadas`
                  : "0 horas apontadas"}
              </span>

              {hoveredDay.data.isLeave && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <PalmtreeIcon className="size-3" />
                  Férias / Recesso
                </span>
              )}
            </div>
          </div>

          {/* Lista de Clientes e Horas naquele dia */}
          <div className="py-2 space-y-1.5">
            {hoveredDay.data.byClient.length > 0 ? (
              <>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Clientes neste dia:
                </span>
                <div className="space-y-1.5">
                  {hoveredDay.data.byClient.map((client) => (
                    <div key={client.clientName} className="space-y-0.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground truncate max-w-[160px]" title={client.clientName}>
                          {client.clientName}
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatHours(client.hours)}
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.min(client.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-1">
                {hoveredDay.data.isLeave
                  ? "Dia marcado como recesso/férias."
                  : hoveredDay.data.isBusinessDay
                  ? "Nenhum apontamento registrado neste dia útil."
                  : "Fim de semana (sem apontamentos)."}
              </p>
            )}
          </div>

          <div className="border-t pt-1.5 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>Clique para abrir apontamentos</span>
            <ExternalLinkIcon className="size-2.5" />
          </div>
        </div>
      )}
    </Card>
  );
}
