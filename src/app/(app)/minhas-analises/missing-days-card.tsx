"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BellIcon,
  BellRingIcon,
  CalendarCheck2Icon,
  CalendarX2Icon,
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
            ? "border border-amber-500/30 dark:border-amber-500/20 bg-card transition-colors shadow-xs"
            : "border border-border/70 bg-card shadow-xs"
        }
      >
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {/* Sininho de Notificação Minimalista */}
              {hasMissing ? (
                <div className="relative flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <BellRingIcon className="size-4 animate-bounce" />
                  <span className="absolute -top-0.5 -right-0.5 flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                  </span>
                </div>
              ) : (
                <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <BellIcon className="size-4" />
                </div>
              )}

              <CardTitle className="text-base font-semibold">
                Dias úteis sem apontamento
              </CardTitle>

              {hasMissing ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {missingDays.length} {missingDays.length === 1 ? "pendência" : "pendências"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CalendarCheck2Icon className="size-3" />
                  Regularizado
                </span>
              )}
            </div>

            <CardDescription className="text-xs">
              {hasMissing ? (
                <span>
                  Você possui {missingDays.length}{" "}
                  {missingDays.length === 1 ? "dia útil sem apontamento" : "dias úteis sem apontamento"}.
                  {lastEntryDate
                    ? ` Último lançamento em ${formatDate(lastEntryDate)}.`
                    : " Nenhum lançamento registrado no período."}
                </span>
              ) : (
                <span>
                  {lastEntryDate
                    ? `Último lançamento em ${formatDate(lastEntryDate)}.`
                    : "Nenhum apontamento registrado no período."}
                </span>
              )}
            </CardDescription>
          </div>

          {/* Botão de férias/recesso na mesma linha */}
          <div className="flex items-center gap-2 shrink-0">
            <LeavesDialog
              currentLeaves={leaves}
              triggerText="Informar férias / recesso"
              triggerVariant="outline"
              triggerClassName="h-8 text-xs font-medium border-border/70 hover:bg-muted"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {!hasMissing ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span>🎉</span>
              Nenhum dia útil pendente no período. Todas as horas estão regularizadas!
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Selecione uma data para lançar horas ou registrar recesso:
              </p>
              <div className="flex flex-wrap gap-2">
                {missingDays.map((day) => (
                  <div
                    key={day}
                    className="group inline-flex items-center rounded-md border border-border/60 bg-muted/30 hover:bg-muted/60 px-2.5 py-1 text-xs transition-colors shadow-2xs"
                  >
                    <Link
                      href={`/apontamentos?semana=${day}`}
                      className="flex items-center gap-1.5 font-medium text-foreground hover:underline"
                      title="Clique para lançar horas nesta data"
                    >
                      <CalendarX2Icon className="size-3 text-muted-foreground" />
                      {formatDate(day)}
                    </Link>
                    <span className="mx-1 text-muted-foreground/40">·</span>
                    <button
                      type="button"
                      onClick={() => handleMarkLeaveForDay(day)}
                      className="text-[11px] text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                      title="Marcar este dia como Férias / Recesso"
                    >
                      🏖️ Férias
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leaveDays.length > 0 && (
            <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
              <PalmtreeIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span>
                <strong>{leaveDays.length} {leaveDays.length === 1 ? "dia útil considerado" : "dias úteis considerados"} em férias/recesso.</strong> Deduzidos da jornada esperada.
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
