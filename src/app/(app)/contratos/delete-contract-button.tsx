"use client";

import { DeleteButton } from "@/components/delete-button";
import { deleteContractAction } from "./actions";

export function DeleteContractButton({
  contractId,
  contractName,
  redirectToClient = false,
  label = "Excluir contrato",
  iconOnly = false,
  variant = "ghost",
  className,
}: {
  contractId: string;
  contractName: string;
  redirectToClient?: boolean;
  label?: string;
  iconOnly?: boolean;
  variant?: "ghost" | "outline" | "destructive" | "secondary" | "default";
  className?: string;
}) {
  const hiddenFields: Record<string, string> = { id: contractId };
  if (redirectToClient) {
    hiddenFields.redirectToClient = "true";
  }

  return (
    <DeleteButton
      action={deleteContractAction}
      hiddenFields={hiddenFields}
      title="Excluir contrato"
      description={`Tem certeza que deseja excluir o contrato "${contractName}"? Esta ação removerá o contrato e seus vínculos associados. Se houver apontamentos de horas vinculados, a exclusão será bloqueada para proteger o histórico.`}
      label={label}
      iconOnly={iconOnly}
      variant={variant}
      className={className}
    />
  );
}
