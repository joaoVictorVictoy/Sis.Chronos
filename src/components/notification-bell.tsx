"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  BellIcon,
  BellRingIcon,
  CalendarX2Icon,
  CheckCheckIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NotificationBellProps {
  missingDaysCount?: number;
  pendingApprovalsCount?: number;
}

export function NotificationBell({
  missingDaysCount = 0,
  pendingApprovalsCount = 0,
}: NotificationBellProps) {
  const totalPending = missingDaysCount + pendingApprovalsCount;
  const hasPending = totalPending > 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Notificações: ${totalPending} pendências`}
          >
            {hasPending ? (
              <>
                <BellRingIcon className="size-4 text-amber-500 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white shadow-2xs">
                  {totalPending > 9 ? "9+" : totalPending}
                </span>
              </>
            ) : (
              <BellIcon className="size-4" />
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-3 space-y-3 shadow-lg">
        <PopoverHeader className="border-b pb-2">
          <div className="flex items-center justify-between">
            <PopoverTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              {hasPending ? (
                <BellRingIcon className="size-3.5 text-amber-500" />
              ) : (
                <BellIcon className="size-3.5 text-muted-foreground" />
              )}
              Notificações
            </PopoverTitle>
            {hasPending ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                {totalPending} {totalPending === 1 ? "pendência" : "pendências"}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Em dia
              </span>
            )}
          </div>
        </PopoverHeader>

        <div className="space-y-2">
          {hasPending ? (
            <>
              {missingDaysCount > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <CalendarX2Icon className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Horas não apontadas</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Você possui <strong>{missingDaysCount} {missingDaysCount === 1 ? "dia útil" : "dias úteis"}</strong> sem apontamento no período.
                  </p>
                  <Link
                    href="/apontamentos"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline pt-0.5"
                  >
                    Lançar horas em Apontamentos
                    <ArrowRightIcon className="size-3" />
                  </Link>
                </div>
              )}

              {pendingApprovalsCount > 0 && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                    <CheckCheckIcon className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Aprovações Pendentes</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Existem <strong>{pendingApprovalsCount} {pendingApprovalsCount === 1 ? "lançamento" : "lançamentos"}</strong> aguardando revisão da equipe.
                  </p>
                  <Link
                    href="/aprovacoes"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline pt-0.5"
                  >
                    Revisar apontamentos
                    <ArrowRightIcon className="size-3" />
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="py-3 text-center space-y-1 text-muted-foreground">
              <CheckCircle2Icon className="size-6 mx-auto text-emerald-500/80" />
              <p className="text-xs font-medium text-foreground">Tudo em dia!</p>
              <p className="text-[11px]">Nenhuma pendência ou dia útil em aberto.</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
