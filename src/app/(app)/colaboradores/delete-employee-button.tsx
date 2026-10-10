"use client";

import { DeleteButton } from "@/components/delete-button";
import { deleteEmployeeAction } from "./actions";

export function DeleteEmployeeButton({
  employeeId,
  employeeName,
  variant = "ghost",
  label = "Excluir colaborador",
  iconOnly = false,
  className,
}: {
  employeeId: string;
  employeeName: string;
  variant?: "ghost" | "outline" | "destructive" | "secondary" | "default";
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <DeleteButton
      action={deleteEmployeeAction}
      hiddenFields={{ id: employeeId }}
      title={`Excluir colaborador · ${employeeName}`}
      description={`Tem certeza que deseja excluir o cadastro de "${employeeName}"? Esta ação removerá o colaborador, histórico de custos e eventuais permissões de acesso ao sistema. Esta operação é irreversível.`}
      label={label}
      iconOnly={iconOnly}
      variant={variant}
      className={className}
    />
  );
}
