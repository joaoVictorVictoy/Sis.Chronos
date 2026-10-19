import type { ContractMetricsRow, Profitability, Projection } from "@/lib/profitability";

export type MonthPoint = {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  desiredMargin: number | null;
  hours: number;
};

export type ContractReport = {
  row: ContractMetricsRow;
  profitability: Profitability;
  projection: Projection | null;
  /** Reajuste necessário para atingir a margem desejada (fração). */
  adjustment: number | null;
};

export type ClientHoursEntry = {
  id: string;
  entryDate: string;
  startTime: string | null;
  endTime: string | null;
  minutes: number;
  hours: number;
  description: string | null;
  billable: boolean;
  status: string;
  costAmount: number;
  employeeId: string;
  employeeName: string;
  activityId: string;
  activityName: string;
  areaName: string;
  contractId: string | null;
  contractName: string | null;
};

export type ClientHoursSummary = {
  id: string;
  name: string;
  legalName: string;
  active: boolean;
  totalMinutes: number;
  totalHours: number;
  billableMinutes: number;
  billableHours: number;
  nonBillableHours: number;
  billableShare: number;
  totalCost: number;
  entriesCount: number;
  employeesCount: number;
  byEmployee: {
    id: string;
    name: string;
    minutes: number;
    hours: number;
    cost: number;
    percentage: number;
  }[];
  byActivity: {
    id: string;
    name: string;
    areaName: string;
    minutes: number;
    hours: number;
    billable: boolean;
    percentage: number;
  }[];
  byContract: {
    id: string;
    name: string;
    minutes: number;
    hours: number;
    percentage: number;
  }[];
  entries: ClientHoursEntry[];
};

export type ClientHoursReport = {
  period: { from: string; to: string; label: string };
  clients: ClientHoursSummary[];
  totalCompanyHours: number;
};
