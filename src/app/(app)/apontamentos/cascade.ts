import type { ActivityOption, AreaOption, ClientAreaOption, ContractOption } from "./page";

/** Retorna as áreas válidas para o cliente selecionado (ou todas as áreas ativas se sem vínculo específico). */
export function getAvailableAreas(
  clientId: string,
  areas: AreaOption[],
  clientAreas: ClientAreaOption[],
): AreaOption[] {
  if (!clientId) return areas;

  const directAreaIds = clientAreas
    .filter((ca) => ca.clientId === clientId)
    .map((ca) => ca.areaId);

  if (directAreaIds.length > 0) {
    const filtered = areas.filter((a) => directAreaIds.includes(a.id));
    if (filtered.length > 0) return filtered;
  }

  return areas;
}

/** Filtra atividades pertencentes à área e ao cliente (ou internas quando clientId é vazio). */
export function getAvailableActivities(
  areaId: string,
  clientId: string,
  activities: ActivityOption[],
): ActivityOption[] {
  if (!areaId) return [];
  return activities.filter((act) => {
    if (act.area_id !== areaId) return false;
    if (clientId) {
      return act.client_id === clientId;
    }
    return !act.client_id;
  });
}

/**
 * Calcula a nova tripla (clientId, areaId, activityId) ao trocar o cliente:
 * 1. Mantém a área atual se ela existir no novo cliente E tiver atividades disponíveis.
 * 2. Caso contrário, prioriza a primeira área do novo cliente que tenha atividades cadastradas.
 * 3. Se nenhuma área tiver atividades, usa a primeira área disponível do cliente.
 * 4. Mantém a atividade atual se continuar válida; senão seleciona a primeira atividade válida.
 */
export function resolveClientSelection({
  newClientId,
  currentAreaId,
  currentActivityId,
  areas,
  activities,
  clientAreas,
}: {
  newClientId: string;
  currentAreaId: string;
  currentActivityId: string;
  areas: AreaOption[];
  activities: ActivityOption[];
  clientAreas: ClientAreaOption[];
}): { clientId: string; areaId: string; activityId: string } {
  const availableAreas = getAvailableAreas(newClientId, areas, clientAreas);

  const currentAreaValid = availableAreas.some((a) => a.id === currentAreaId);
  const currentAreaActivities = currentAreaValid
    ? getAvailableActivities(currentAreaId, newClientId, activities)
    : [];

  let targetAreaId = currentAreaId;
  if (!currentAreaValid || currentAreaActivities.length === 0) {
    const firstAreaWithActivities = availableAreas.find(
      (a) => getAvailableActivities(a.id, newClientId, activities).length > 0,
    );
    if (firstAreaWithActivities) {
      targetAreaId = firstAreaWithActivities.id;
    } else if (!currentAreaValid) {
      targetAreaId = availableAreas[0]?.id ?? "";
    }
  }

  const targetActivities = getAvailableActivities(targetAreaId, newClientId, activities);
  const activityId = targetActivities.some((act) => act.id === currentActivityId)
    ? currentActivityId
    : targetActivities[0]?.id ?? "";

  return {
    clientId: newClientId,
    areaId: targetAreaId,
    activityId,
  };
}

/** Calcula (areaId, activityId) ao trocar a área de atuação. */
export function resolveAreaSelection({
  newAreaId,
  currentClientId,
  currentActivityId,
  activities,
}: {
  newAreaId: string;
  currentClientId: string;
  currentActivityId: string;
  activities: ActivityOption[];
}): { areaId: string; activityId: string } {
  const targetActivities = getAvailableActivities(newAreaId, currentClientId, activities);
  const activityId = targetActivities.some((act) => act.id === currentActivityId)
    ? currentActivityId
    : targetActivities[0]?.id ?? "";

  return {
    areaId: newAreaId,
    activityId,
  };
}

/**
 * Resolve o contractId para envio no formulário.
 * Nunca mantém um defaultContractId antigo quando o usuário muda para "Sem cliente" ou para outro cliente.
 */
export function resolveContractId({
  selectedClientId,
  contracts,
  defaultClientId,
  defaultContractId,
}: {
  selectedClientId: string;
  contracts: ContractOption[];
  defaultClientId?: string | null;
  defaultContractId?: string | null;
}): string {
  if (!selectedClientId) return "";
  const active = contracts.find((c) => c.clientId === selectedClientId);
  if (active) return active.id;
  if (defaultContractId && defaultClientId && defaultClientId === selectedClientId) {
    return defaultContractId;
  }
  return "";
}
