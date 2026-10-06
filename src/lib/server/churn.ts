import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import {
  monthlyEquivalent,
  TERMINATION_REASON_LABELS,
  TERMINATION_SUB_REASON_LABELS,
  type TerminationReason,
  type TerminationSubReason,
} from "@/lib/contracts";
import type { Period } from "@/lib/periods";
import type { ContractPeriodicity, Tables } from "@/lib/database.types";

export type ChurnContractItem = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  amount: number;
  periodicity: ContractPeriodicity;
  monthlyRevenue: number;
  startDate: string;
  endDate: string | null;
  terminatedAt: string | null;
  terminationReason: TerminationReason | null;
  terminationSubReason: TerminationSubReason | null;
  terminationNotes: string | null;
  terminationPenalty: number | null;
  isRegularEnd: boolean;
};

export type ChurnReasonGroup = {
  key: string;
  label: string;
  category: "cliente" | "consultoria" | "regular" | "outro";
  count: number;
  lostMrr: number;
  percentage: number;
};

export type ChurnBottleneck = {
  type: "entrega" | "financeiro" | "mercado";
  title: string;
  lostMrr: number;
  count: number;
  description: string;
};

export type ChurnReport = {
  period: Period;
  contracts: ChurnContractItem[];
  totalTerminatedCount: number;
  actualChurnCount: number; // Exclui término regular de projeto
  regularEndCount: number;
  lostMrr: number;
  lostAnnualRevenue: number;
  activeMrr: number;
  churnRate: number; // lostMrr / (activeMrr + lostMrr)
  totalPenalties: number;
  reasonsBreakdown: ChurnReasonGroup[];
  bottlenecks: ChurnBottleneck[];
};

export async function getChurnReport(period: Period): Promise<ChurnReport> {
  await requireRole(["admin", "gestor"]);
  const supabase = await createClient();

  const [{ data: activeContracts }, { data: terminatedContracts }] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, amount, periodicity")
      .eq("status", "ativo"),
    supabase
      .from("contracts")
      .select(
        "id, name, amount, periodicity, start_date, end_date, termination_reason, termination_sub_reason, termination_notes, terminated_at, termination_penalty, clients(id, legal_name, trade_name)",
      )
      .eq("status", "encerrado"),
  ]);

  const activeMrr = (activeContracts ?? []).reduce(
    (acc, c) => acc + monthlyEquivalent(Number(c.amount), c.periodicity),
    0,
  );

  // Filtra contratos cuja data de corte (terminated_at ou end_date) caiu no período consultado
  const inPeriodContracts = (terminatedContracts ?? []).filter((c) => {
    const cutOff = c.terminated_at || c.end_date;
    return cutOff && cutOff >= period.from && cutOff <= period.to;
  });

  const contracts: ChurnContractItem[] = inPeriodContracts.map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = c.clients as any;
    const clientName = client?.trade_name || client?.legal_name || "Cliente";
    const monthlyRevenue = monthlyEquivalent(Number(c.amount), c.periodicity);
    const isRegularEnd = c.termination_reason === "termino_prazo";

    return {
      id: c.id,
      name: c.name,
      clientId: client?.id ?? "",
      clientName,
      amount: Number(c.amount),
      periodicity: c.periodicity,
      monthlyRevenue,
      startDate: c.start_date,
      endDate: c.end_date,
      terminatedAt: c.terminated_at,
      terminationReason: c.termination_reason as TerminationReason | null,
      terminationSubReason: c.termination_sub_reason as TerminationSubReason | null,
      terminationNotes: c.termination_notes,
      terminationPenalty: c.termination_penalty ? Number(c.termination_penalty) : null,
      isRegularEnd,
    };
  });

  // Ordena por maior impacto financeiro (MRR)
  contracts.sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

  const totalTerminatedCount = contracts.length;
  const actualChurnCount = contracts.filter((c) => !c.isRegularEnd).length;
  const regularEndCount = contracts.filter((c) => c.isRegularEnd).length;
  const lostMrr = contracts.reduce((acc, c) => acc + c.monthlyRevenue, 0);
  const lostAnnualRevenue = lostMrr * 12;
  const churnRate = activeMrr + lostMrr > 0 ? lostMrr / (activeMrr + lostMrr) : 0;
  const totalPenalties = contracts.reduce((acc, c) => acc + (c.terminationPenalty ?? 0), 0);

  // Agrupamento por motivos específicos
  const groupsMap = new Map<string, { label: string; category: ChurnReasonGroup["category"]; count: number; lostMrr: number }>();

  for (const c of contracts) {
    let key = "outro";
    let label = "Outro motivo";
    let category: ChurnReasonGroup["category"] = "outro";

    if (c.terminationSubReason) {
      key = c.terminationSubReason;
      label = TERMINATION_SUB_REASON_LABELS[c.terminationSubReason] ?? c.terminationSubReason;
      if (c.terminationReason === "rescisao_cliente") category = "cliente";
      else if (c.terminationReason === "rescisao_consultoria") category = "consultoria";
      else if (c.terminationReason === "termino_prazo") category = "regular";
    } else if (c.terminationReason) {
      key = c.terminationReason;
      label = TERMINATION_REASON_LABELS[c.terminationReason] ?? c.terminationReason;
      if (c.terminationReason === "rescisao_cliente") category = "cliente";
      else if (c.terminationReason === "rescisao_consultoria") category = "consultoria";
      else if (c.terminationReason === "termino_prazo") category = "regular";
    }

    const current = groupsMap.get(key) ?? { label, category, count: 0, lostMrr: 0 };
    current.count += 1;
    current.lostMrr += c.monthlyRevenue;
    groupsMap.set(key, current);
  }

  const reasonsBreakdown: ChurnReasonGroup[] = [...groupsMap.entries()]
    .map(([key, data]) => ({
      key,
      label: data.label,
      category: data.category,
      count: data.count,
      lostMrr: data.lostMrr,
      percentage: lostMrr > 0 ? (data.lostMrr / lostMrr) * 100 : 0,
    }))
    .sort((a, b) => b.lostMrr - a.lostMrr);

  // Inteligência de Gargalos (Entrega, Financeiro, Mercado)
  const bottlenecks: ChurnBottleneck[] = [];

  const deliveryIssues = contracts.filter(
    (c) => c.terminationSubReason === "insatisfacao" || c.terminationSubReason === "escopo_inviavel",
  );
  if (deliveryIssues.length > 0) {
    const deliveryLost = deliveryIssues.reduce((acc, c) => acc + c.monthlyRevenue, 0);
    bottlenecks.push({
      type: "entrega",
      title: "Gargalo Operacional ou de Entrega",
      lostMrr: deliveryLost,
      count: deliveryIssues.length,
      description: `${deliveryIssues.length} contrato(s) rescindido(s) por insatisfação com entregas ou desalinhamento técnico de escopo. Alinhe com a liderança para estancar evasões.`,
    });
  }

  const financialIssues = contracts.filter(
    (c) => c.terminationSubReason === "inadimplencia" || c.terminationSubReason === "rentabilidade_negativa",
  );
  if (financialIssues.length > 0) {
    const financialLost = financialIssues.reduce((acc, c) => acc + c.monthlyRevenue, 0);
    bottlenecks.push({
      type: "financeiro",
      title: "Risco de Inadimplência ou Prejuízo Operacional",
      lostMrr: financialLost,
      count: financialIssues.length,
      description: `${financialIssues.length} contrato(s) rescindido(s) por falta de pagamento ou inviabilidade econômica. Reavalie as regras de cobrança preventiva.`,
    });
  }

  const marketIssues = contracts.filter(
    (c) =>
      c.terminationSubReason === "corte_custos" ||
      c.terminationSubReason === "trocou_fornecedor" ||
      c.terminationSubReason === "mudanca_estrategia",
  );
  if (marketIssues.length > 0) {
    const marketLost = marketIssues.reduce((acc, c) => acc + c.monthlyRevenue, 0);
    bottlenecks.push({
      type: "mercado",
      title: "Pressão de Custos ou Concorrência",
      lostMrr: marketLost,
      count: marketIssues.length,
      description: `${marketIssues.length} contrato(s) cancelado(s) por restrição orçamentária do cliente ou migração para outro fornecedor.`,
    });
  }

  return {
    period,
    contracts,
    totalTerminatedCount,
    actualChurnCount,
    regularEndCount,
    lostMrr,
    lostAnnualRevenue,
    activeMrr,
    churnRate,
    totalPenalties,
    reasonsBreakdown,
    bottlenecks,
  };
}
