"use client";

import { useState, useTransition } from "react";
import { AlertTriangleIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deleteTenantAction } from "@/app/super-admin/(dashboard)/actions";

export function DangerZoneCard({
  tenantName,
  tenantId,
  isSuperAdmin,
  supportWhatsappUrl,
}: {
  tenantName: string;
  tenantId: string;
  isSuperAdmin: boolean;
  supportWhatsappUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmation = prompt(
      `ATENÇÃO: A exclusão da empresa "${tenantName}" é definitiva e irreversível!\n\nTodos os contratos, apontamentos, clientes e colaboradores serão apagados permanentemente.\n\nPara confirmar a exclusão, digite o nome exato da empresa:`
    );

    if (confirmation !== tenantName) {
      if (confirmation !== null) {
        alert("O nome digitado não confere. Operação de exclusão cancelada.");
      }
      return;
    }

    startTransition(async () => {
      try {
        await deleteTenantAction(tenantId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao excluir empresa.";
        alert(msg);
      }
    });
  };

  return (
    <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
      <CardHeader>
        <CardTitle className="text-base text-destructive flex items-center gap-2">
          <AlertTriangleIcon className="size-4" />
          Zona de Perigo
        </CardTitle>
        <CardDescription>
          Ações permanentes e encerramento da empresa no Sis.Chronos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Excluir Empresa e Cancelar Acesso
          </p>
          <p className="text-xs text-muted-foreground">
            Apaga todos os dados cadastrados, relatórios, apontamentos e acessos dos colaboradores
            de forma irreversível.
          </p>
        </div>

        {isSuperAdmin ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="shrink-0 gap-1.5 cursor-pointer shadow-xs"
          >
            <Trash2Icon className="size-3.5" />
            {isPending ? "Excluindo..." : "Excluir Empresa"}
          </Button>
        ) : supportWhatsappUrl ? (
          <a
            href={supportWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 px-3 text-xs font-semibold gap-1.5 transition-colors shrink-0"
          >
            <Trash2Icon className="size-3.5" />
            Solicitar Cancelamento / Exclusão
          </a>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="shrink-0 gap-1.5 cursor-pointer shadow-xs"
          >
            <Trash2Icon className="size-3.5" />
            {isPending ? "Excluindo..." : "Excluir Empresa"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
