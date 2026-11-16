"use client";

import Link from "next/link";
import { useState } from "react";
import { ClockIcon, LayoutGridIcon, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/info-tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatHours, formatPercent } from "@/lib/format";
import { PERIODICITY_LABELS } from "@/lib/contracts";
import type { HealthStatus } from "@/lib/profitability";

export type PanelItem = {
  contractId: string;
  clientId?: string;
  clientName: string;
  contractName: string;
  periodicity: keyof typeof PERIODICITY_LABELS;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  desiredMargin: number;
  hours: number;
  hoursLimit: number | null;
  consumption: number | null;
  status: HealthStatus;
};

type SortKey = "profit" | "margin" | "revenue" | "consumption";

const SORT_LABELS: Record<SortKey, string> = {
  profit: "Lucro",
  margin: "Margem",
  revenue: "Receita",
  consumption: "Consumo de horas",
};

function ConsumptionBar({
  consumption,
  revenue,
  cost,
  hours,
}: {
  consumption: number | null;
  revenue: number;
  cost: number;
  hours: number;
}) {
  if (revenue <= 0 && (cost > 0 || hours > 0)) {
    return (
      <span className="text-xs font-medium text-[--viz-critical]">
        limite zerado · sem receita contratual
      </span>
    );
  }
  if (consumption === null) {
    return <span className="text-xs text-muted-foreground">sem limite de horas definido</span>;
  }
  const ratio = Math.min(consumption, 1);
  const color = consumption >= 1 ? "var(--viz-critical)" : consumption >= 0.8 ? "var(--viz-warning)" : "var(--viz-1)";
  return (
    <div className="grid gap-1">
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
      <span className="text-xs text-muted-foreground">{formatPercent(consumption)} do limite de horas</span>
    </div>
  );
}

export function ClientsPanel({
  items,
  canSeeCosts = true,
  canManageContracts = false,
  onViewClientHours,
}: {
  items: PanelItem[];
  canSeeCosts?: boolean;
  canManageContracts?: boolean;
  onViewClientHours?: (clientId: string) => void;
}) {
  const [view, setView] = useState<"cards" | "tabela">("cards");
  const [sort, setSort] = useState<SortKey>(canSeeCosts ? "profit" : "consumption");

  const sorted = [...items].sort((a, b) => {
    const pick = (item: PanelItem) =>
      sort === "margin"
        ? (item.margin ?? (item.cost > 0 ? -1 : -Infinity))
        : sort === "revenue"
          ? item.revenue
          : sort === "consumption"
            ? (item.consumption ?? (item.cost > 0 && item.revenue <= 0 ? 999 : -Infinity))
            : item.profit;
    return pick(b) - pick(a);
  });

  const availableSortKeys = (Object.keys(SORT_LABELS) as SortKey[]).filter(
    (key) => canSeeCosts || key === "consumption",
  );

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardTitle>Clientes e contratos</CardTitle>
          <InfoTooltip
            side="right"
            text={
              canSeeCosts
                ? "Margem real contra a desejada e consumo do limite de horas."
                : "Acompanhe as horas e o consumo do limite de horas dos contratos."
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {availableSortKeys.map((key) => (
            <Button
              key={key}
              size="xs"
              variant={sort === key ? "secondary" : "ghost"}
              onClick={() => setSort(key)}
            >
              {SORT_LABELS[key]}
            </Button>
          ))}
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => setView((v) => (v === "cards" ? "tabela" : "cards"))}
            aria-label={view === "cards" ? "Ver em tabela" : "Ver em cards"}
          >
            {view === "cards" ? <TableIcon /> : <LayoutGridIcon />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState>Nenhum contrato com movimento no período.</EmptyState>
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((item) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.clientName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.contractName} · {PERIODICITY_LABELS[item.periodicity]}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  {canSeeCosts ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Receita</p>
                          <p className="tabular-nums">{formatCurrency(item.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Custo</p>
                          <p className="tabular-nums">{formatCurrency(item.cost)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Lucro</p>
                          <p className="tabular-nums font-medium">{formatCurrency(item.profit)}</p>
                        </div>
                      </div>

                      <p className="text-sm flex items-center flex-wrap gap-1">
                        <span>Margem</span>
                        {item.margin !== null ? (
                          <span
                            className={`font-medium tabular-nums ${
                              item.margin < 0
                                ? "text-[--viz-critical]"
                                : item.margin >= item.desiredMargin
                                  ? "text-[--viz-good]"
                                  : "text-[--viz-warning]"
                            }`}
                          >
                            {formatPercent(item.margin)}
                          </span>
                        ) : item.cost > 0 ? (
                          <span className="font-semibold text-[--viz-critical]">
                            Prejuízo (-100%)
                          </span>
                        ) : (
                          <span className="font-medium text-muted-foreground">—</span>
                        )}
                        <span className="text-muted-foreground">
                          · meta {formatPercent(item.desiredMargin)}
                        </span>
                      </p>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm py-1">
                      <div>
                        <p className="text-xs text-muted-foreground">Horas Apontadas</p>
                        <p className="tabular-nums font-medium">{formatHours(item.hours)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Consumo de Horas</p>
                        <p className="tabular-nums font-medium">
                          {item.consumption === null ? "—" : formatPercent(item.consumption)}
                        </p>
                      </div>
                    </div>
                  )}

                  <ConsumptionBar
                    consumption={item.consumption}
                    revenue={item.revenue}
                    cost={item.cost}
                    hours={item.hours}
                  />

                  {item.clientId && (
                    <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                      <span className="text-muted-foreground">Apontamentos</span>
                      {onViewClientHours ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onViewClientHours(item.clientId!);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline cursor-pointer"
                        >
                          <ClockIcon className="size-3.5" />
                          Ver horas do mês
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-primary">
                          <ClockIcon className="size-3.5" />
                          Ver horas do mês
                        </span>
                      )}
                    </div>
                  )}
                </>
              );

              return canManageContracts ? (
                <Link
                  key={item.contractId}
                  href={`/contratos/${item.contractId}`}
                  className="grid gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/40"
                >
                  {content}
                </Link>
              ) : (
                <div key={item.contractId} className="grid gap-3 rounded-lg border p-4">
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente / contrato</TableHead>
                {canSeeCosts ? (
                  <>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                  </>
                ) : (
                  <TableHead>Periodicidade</TableHead>
                )}
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Consumo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-24">Extrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((item) => (
                <TableRow key={item.contractId}>
                  <TableCell>
                    {canManageContracts ? (
                      <Link href={`/contratos/${item.contractId}`} className="font-medium hover:underline">
                        {item.clientName}
                      </Link>
                    ) : (
                      <span className="font-medium">{item.clientName}</span>
                    )}
                    <p className="text-xs text-muted-foreground">{item.contractName}</p>
                  </TableCell>
                  {canSeeCosts ? (
                    <>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.cost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.profit)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.margin !== null ? (
                          <span
                            className={
                              item.margin < 0
                                ? "text-[--viz-critical] font-medium"
                                : item.margin >= item.desiredMargin
                                  ? "text-[--viz-good] font-medium"
                                  : "text-[--viz-warning] font-medium"
                            }
                          >
                            {formatPercent(item.margin)}
                          </span>
                        ) : item.cost > 0 ? (
                          <span className="text-[--viz-critical] font-semibold text-xs">
                            Prejuízo (-100%)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatPercent(item.desiredMargin)}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell className="text-muted-foreground">{PERIODICITY_LABELS[item.periodicity]}</TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{formatHours(item.hours)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.consumption !== null ? (
                      formatPercent(item.consumption)
                    ) : item.revenue <= 0 && (item.cost > 0 || item.hours > 0) ? (
                      <span className="text-xs text-[--viz-critical] font-medium">Sem receita</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {item.clientId ? (
                      onViewClientHours ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => onViewClientHours(item.clientId!)}
                          title="Ver todas as horas deste cliente no mês"
                          className="gap-1 text-xs"
                        >
                          <ClockIcon className="size-3.5" />
                          Horas
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="ghost"
                          nativeButton={false}
                          render={<Link href={`/dashboard?aba=cliente&cliente=${item.clientId}`} />}
                          title="Ver todas as horas deste cliente no mês"
                          className="gap-1 text-xs"
                        >
                          <ClockIcon className="size-3.5" />
                          Horas
                        </Button>
                      )
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
