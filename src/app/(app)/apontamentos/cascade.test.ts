import { describe, expect, it } from "vitest";
import {
  getAvailableActivities,
  getAvailableAreas,
  resolveAreaSelection,
  resolveClientSelection,
  resolveContractId,
} from "./cascade";
import type { ActivityOption, AreaOption, ClientAreaOption, ContractOption } from "./page";

const areas: AreaOption[] = [
  { id: "area-adm", name: "Administrativo" },
  { id: "area-com", name: "Comercial/ Marketing" },
  { id: "area-fin", name: "Financeiro" },
];

const clientAreas: ClientAreaOption[] = [
  { clientId: "cli-1", areaId: "area-com" },
  { clientId: "cli-1", areaId: "area-fin" },
  { clientId: "cli-2", areaId: "area-com" },
  { clientId: "cli-2", areaId: "area-fin" },
];

const activities: ActivityOption[] = [
  { id: "act-int-adm", name: "Reunião interna", billable: false, area_id: "area-adm", client_id: null },
  { id: "act-int-fin", name: "Faturamento interno", billable: false, area_id: "area-fin", client_id: null },
  { id: "act-c1-com", name: "CRM", billable: true, area_id: "area-com", client_id: "cli-1" },
  { id: "act-c1-fin", name: "DRE", billable: true, area_id: "area-fin", client_id: "cli-1" },
  // cli-2 tem area-com em clientAreas, mas só tem atividade cadastrada em area-fin
  { id: "act-c2-fin", name: "Fluxo de Caixa", billable: true, area_id: "area-fin", client_id: "cli-2" },
];

const contracts: ContractOption[] = [
  { id: "con-1", name: "Financeiro", clientId: "cli-1", clientName: "BNR001: Clínica Pró Saúde" },
];

describe("cascade selectors", () => {
  it("filtra áreas vinculadas ao cliente e retorna todas quando sem cliente", () => {
    expect(getAvailableAreas("", areas, clientAreas).map((a) => a.id)).toEqual([
      "area-adm",
      "area-com",
      "area-fin",
    ]);
    expect(getAvailableAreas("cli-1", areas, clientAreas).map((a) => a.id)).toEqual([
      "area-com",
      "area-fin",
    ]);
  });

  it("ao trocar de cliente para um que não tem atividade na área atual, seleciona uma área que tenha atividade", () => {
    const result = resolveClientSelection({
      newClientId: "cli-2",
      currentAreaId: "area-com",
      currentActivityId: "act-c1-com",
      areas,
      activities,
      clientAreas,
    });

    expect(result).toEqual({
      clientId: "cli-2",
      areaId: "area-fin",
      activityId: "act-c2-fin",
    });
  });

  it("ao trocar de Sem cliente para um cliente, seleciona área e atividade válidas desse cliente", () => {
    const result = resolveClientSelection({
      newClientId: "cli-1",
      currentAreaId: "area-adm",
      currentActivityId: "act-int-adm",
      areas,
      activities,
      clientAreas,
    });

    expect(result).toEqual({
      clientId: "cli-1",
      areaId: "area-com",
      activityId: "act-c1-com",
    });
  });

  it("ao trocar de cliente para Sem cliente (interno), escolhe atividade interna válida", () => {
    const result = resolveClientSelection({
      newClientId: "",
      currentAreaId: "area-com",
      currentActivityId: "act-c1-com",
      areas,
      activities,
      clientAreas,
    });

    // Não há atividade interna em area-com, então pula para area-adm (que tem act-int-adm)
    expect(result).toEqual({
      clientId: "",
      areaId: "area-adm",
      activityId: "act-int-adm",
    });
  });

  it("ao trocar a área manualmente, seleciona a primeira atividade da nova área", () => {
    const result = resolveAreaSelection({
      newAreaId: "area-fin",
      currentClientId: "cli-1",
      currentActivityId: "act-c1-com",
      activities,
    });

    expect(result).toEqual({
      areaId: "area-fin",
      activityId: "act-c1-fin",
    });
  });

  it("resolveContractId não vaza defaultContractId ao trocar para Sem cliente ou outro cliente", () => {
    expect(
      resolveContractId({
        selectedClientId: "",
        contracts,
        defaultClientId: "cli-1",
        defaultContractId: "con-1",
      }),
    ).toBe("");

    expect(
      resolveContractId({
        selectedClientId: "cli-2",
        contracts,
        defaultClientId: "cli-1",
        defaultContractId: "con-1",
      }),
    ).toBe("");

    expect(
      resolveContractId({
        selectedClientId: "cli-1",
        contracts,
        defaultClientId: "cli-1",
        defaultContractId: "con-1",
      }),
    ).toBe("con-1");
  });

  it("filtra atividades estritamente pelo cliente ou interno", () => {
    expect(getAvailableActivities("area-fin", "cli-1", activities).map((a) => a.id)).toEqual([
      "act-c1-fin",
    ]);
    expect(getAvailableActivities("area-fin", "", activities).map((a) => a.id)).toEqual([
      "act-int-fin",
    ]);
  });
});
