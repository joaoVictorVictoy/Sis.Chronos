"use client";

import { useState } from "react";
import { HistoryIcon, SearchIcon, ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AuditLogEntry } from "./audit";

export function AuditLogsDialog({ logs }: { logs: AuditLogEntry[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredLogs = logs.filter((log) => {
    const term = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.tenantName.toLowerCase().includes(term) ||
      log.superAdminEmail.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term)
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <HistoryIcon className="size-4" />
            <span>Auditoria ({logs.length})</span>
          </Button>
        }
      />

      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[85vh] p-6 flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="size-5 text-primary" />
            Histórico de Ações do Super Admin
          </DialogTitle>
          <DialogDescription>
            Registro cronológico de alterações contratuais, suspensões, logins de suporte e links gerados.
          </DialogDescription>
        </DialogHeader>

        <div className="relative pt-2">
          <SearchIcon className="absolute left-3 top-5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empresa, ação, e-mail ou detalhe..."
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 pt-2 max-h-[50vh]">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-10 border rounded-lg bg-muted/20">
              <ShieldAlertIcon className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum registro de auditoria encontrado.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors space-y-1.5 text-sm"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-semibold text-xs">
                      {log.action}
                    </Badge>
                    <span className="font-medium text-foreground">{log.tenantName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{log.details}</p>

                <div className="text-[11px] text-muted-foreground/75 flex items-center justify-between pt-1 border-t border-border/50">
                  <span>Executado por: <strong className="text-foreground/80">{log.superAdminEmail}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
