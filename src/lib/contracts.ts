import type { ContractPeriodicity, ContractStatus, ExpenseCategory, ExpenseRecurrence } from "@/lib/database.types";

export const PERIODICITY_LABELS: Record<ContractPeriodicity, string> = {
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  projeto: "Projeto fechado",
};

/** Meses de cada período; `null` para projeto fechado (valor único). */
export const PERIODICITY_MONTHS: Record<ContractPeriodicity, number | null> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
  projeto: null,
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

export type TerminationReason = "termino_prazo" | "rescisao_cliente" | "rescisao_consultoria" | "outro";

export const TERMINATION_REASON_LABELS: Record<TerminationReason, string> = {
  termino_prazo: "Término regular do prazo / Projeto concluído",
  rescisao_cliente: "Rescisão pelo cliente (Corte de custos / Insatisfação / Trocou fornecedor)",
  rescisao_consultoria: "Rescisão pela consultoria (Inadimplência / Escopo inviável / Rentabilidade)",
  outro: "Outro motivo",
};

export type TerminationSubReason =
  | "conclusao_projeto"
  | "fim_vigencia"
  | "corte_custos"
  | "insatisfacao"
  | "trocou_fornecedor"
  | "mudanca_estrategia"
  | "inadimplencia"
  | "escopo_inviavel"
  | "rentabilidade_negativa"
  | "conflito_relacionamento"
  | "outro";

export const TERMINATION_SUB_REASON_LABELS: Record<TerminationSubReason, string> = {
  conclusao_projeto: "Projeto concluído com êxito",
  fim_vigencia: "Término da vigência regular (sem renovação)",
  corte_custos: "Corte de custos / Orçamento do cliente",
  insatisfacao: "Insatisfação com a entrega ou atendimento",
  trocou_fornecedor: "Trocou de fornecedor / Concorrência",
  mudanca_estrategia: "Mudança de estratégia interna do cliente",
  inadimplencia: "Inadimplência / Falta de pagamento",
  escopo_inviavel: "Escopo inviável / Desalinhamento técnico",
  rentabilidade_negativa: "Rentabilidade negativa / Prejuízo operacional",
  conflito_relacionamento: "Conflito de relacionamento",
  outro: "Outro motivo",
};

export const SUB_REASONS_BY_MAIN_REASON: Record<
  TerminationReason,
  { value: TerminationSubReason; label: string }[]
> = {
  termino_prazo: [
    { value: "conclusao_projeto", label: "Projeto concluído com êxito" },
    { value: "fim_vigencia", label: "Término da vigência regular (sem renovação)" },
    { value: "outro", label: "Outro término regular" },
  ],
  rescisao_cliente: [
    { value: "insatisfacao", label: "Insatisfação com a entrega ou atendimento" },
    { value: "corte_custos", label: "Corte de custos / Orçamento do cliente" },
    { value: "trocou_fornecedor", label: "Trocou de fornecedor / Concorrência" },
    { value: "mudanca_estrategia", label: "Mudança de estratégia interna" },
    { value: "outro", label: "Outro motivo pelo cliente" },
  ],
  rescisao_consultoria: [
    { value: "inadimplencia", label: "Inadimplência / Falta de pagamento" },
    { value: "escopo_inviavel", label: "Escopo inviável / Desalinhamento técnico" },
    { value: "rentabilidade_negativa", label: "Rentabilidade negativa / Prejuízo operacional" },
    { value: "conflito_relacionamento", label: "Conflito de relacionamento" },
    { value: "outro", label: "Outro motivo pela consultoria" },
  ],
  outro: [
    { value: "outro", label: "Outro motivo específico" },
  ],
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  deslocamento: "Deslocamento",
  software: "Software",
  terceirizado: "Terceirizado",
  impostos: "Impostos",
  outros: "Outros",
};

export const EXPENSE_RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  pontual: "Pontual",
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

/** Receita equivalente por mês (para comparar contratos de periodicidades diferentes). */
export function monthlyEquivalent(amount: number, periodicity: ContractPeriodicity, months?: number | null): number {
  const periodMonths = PERIODICITY_MONTHS[periodicity];
  if (periodMonths) return amount / periodMonths;
  // Projeto fechado: distribui pelo total de meses do projeto
  return months && months > 0 ? amount / months : amount;
}

/** Meses (aproximados) entre duas datas ISO, inclusivo. */
export function monthsBetween(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  const days = (end.getTime() - start.getTime()) / 86_400_000 + 1;
  return days / 30.4375;
}
