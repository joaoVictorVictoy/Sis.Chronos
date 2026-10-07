"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CalendarCheck2Icon,
  CalendarX2Icon,
  FlameIcon,
  PalmtreeIcon,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeavesDialog, type LeaveRecord } from "./leaves-dialog";

interface MissingDaysCardProps {
  missingDays: string[];
  lastEntryDate: string | null;
  leaves: LeaveRecord[];
  leaveDays?: string[];
}

export function MissingDaysCard({
  missingDays,
  lastEntryDate,
  leaves,
  leaveDays = [],
}: MissingDaysCardProps) {
  const [quickDate, setQuickDate] = useState<string | null>(null);
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);

  const hasMissing = missingDays.length > 0;

  const handleMarkLeaveForDay = (day: string) => {
    setQuickDate(day);
    setQuickDialogOpen(true);
  };

  return (
    <>
      <Card
        className={
          hasMissing
            ? "border-2 border-orange-500 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent dark:from-orange-950/40 dark:via-amber-950/20 dark:to-background shadow-lg shadow-orange-500/10 transition-all duration-300"
            : "border-border/60 bg-card"
        }
      >
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {hasMissing ? (
                <div className="flex items-center gap-1.5 rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs animate-pulse">
                  <FlameIcon className="size-3.5 fill-current" />
                  Alerta Urgente
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-600/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CalendarCheck2Icon className="size-3.5" />
                  Tudo em dia
                </div>
              )}
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                {hasMissing && (
                  <AlertTriangleIcon className="size-5 text-orange-600 dark:text-orange-400 inline" />
                )}
                Dias úteis sem apontamento
              </CardTitle>
            </div>

            <CardDescription className={hasMissing ? "text-orange-950 dark:text-orange-200/90 font-medium text-sm" : undefined}>
              {hasMissing ? (
                <span>
                  Você tem <strong>{missingDays.length} {missingDays.length === 1 ? "dia útil pendente" : "dias úteis pendentes"}</strong>.
                  {lastEntryDate
                    ? ` Último apontamento em ${formatDate(lastEntryDate)}.`
                    : " Nenhum apontamento registrado no período."}
                </span>
              ) : (
                <span>
                  {lastEntryDate
                    ? `Último apontamento em ${formatDate(lastEntryDate)}.`
                    : "Nenhum apontamento registrado no período."}
                </span>
              )}
            </CardDescription>
          </div>

          {/* Opção de Férias e Recesso na MESMA LINHA do cabeçalho */}
          <div className="flex items-center gap-2 shrink-0">
            <LeavesDialog
              currentLeaves={leaves}
              triggerText="Informar férias / recesso"
              triggerVariant={hasMissing ? "default" : "outline"}
              triggerClassName={
                hasMissing
                  ? "bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm transition-all"
                  : "border-orange-500/40 text-orange-700 dark:text-orange-400 hover:bg-orange-500/10 font-medium"
              }
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {!hasMissing ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <span>🎉</span>
              Nenhum dia útil em aberto no período avaliado. Todas as horas estão regularizadas!
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-800 dark:text-orange-300">
                Selecione um dia para apontar ou marcar recesso:
              </p>
              <div className="flex flex-wrap gap-2.5">
                {missingDays.map((day) => (
                  <div
                    key={day}
                    className="group inline-flex items-center rounded-lg border border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 dark:bg-orange-950/40 dark:hover:bg-orange-900/60 p-1 text-sm transition-colors shadow-xs"
                  >
                    <Link
                      href={`/apontamentos?semana=${day}`}
                      className="flex items-center gap-1.5 px-2 py-0.5 font-semibold text-orange-950 dark:text-orange-100 hover:underline"
                      title="Clique para lançar horas nesta data"
                    >
                      <CalendarX2Icon className="size-3.5 text-orange-600 dark:text-orange-400" />
                      {formatDate(day)}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleMarkLeaveForDay(day)}
                      className="ml-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-orange-700 hover:bg-orange-500/25 dark:text-orange-300 transition-colors"
                      title="Marcar este dia como Férias / Recesso para não cobrar"
                    >
                      🏖️ Férias
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leaveDays.length > 0 && (
            <div className="rounded-md border border-sky-500/20 bg-sky-500/5 dark:bg-sky-950/20 px-3 py-2 text-xs text-sky-800 dark:text-sky-300 flex items-center gap-2">
              <PalmtreeIcon className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <span>
                <strong>{leaveDays.length} {leaveDays.length === 1 ? "dia útil considerado" : "dias úteis considerados"} em férias/recesso.</strong> Não constam como pendência e foram deduzidos da jornada esperada.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo rápido aberto ao clicar em "🏖️ Férias" em um dia específico */}
      {quickDate && (
        <LeavesDialog
          currentLeaves={leaves}
          initialStartDate={quickDate}
          initialEndDate={quickDate}
          open={quickDialogOpen}
          onOpenChange={(open) => {
            setQuickDialogOpen(open);
            if (!open) setQuickDate(null);
          }}
        />
      )}
    </>
  );
}
