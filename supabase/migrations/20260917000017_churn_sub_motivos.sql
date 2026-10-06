-- =====================================================================
-- Etapa 17: Motivos detalhados de rescisão e inteligência de Churn
-- Adiciona termination_sub_reason a contracts
-- =====================================================================

alter table public.contracts
  add column if not exists termination_sub_reason text check (
    termination_sub_reason is null or termination_sub_reason in (
      'conclusao_projeto',
      'fim_vigencia',
      'corte_custos',
      'insatisfacao',
      'trocou_fornecedor',
      'mudanca_estrategia',
      'inadimplencia',
      'escopo_inviavel',
      'rentabilidade_negativa',
      'conflito_relacionamento',
      'outro'
    )
  );
