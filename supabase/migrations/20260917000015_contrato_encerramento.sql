-- =====================================================================
-- Etapa 14: Encerramento e rescisão guiada de contratos
-- Adiciona campos para motivo do término, notas de rescisão e data de corte.
-- =====================================================================

alter table public.contracts
  add column if not exists termination_reason text check (
    termination_reason is null or termination_reason in ('termino_prazo', 'rescisao_cliente', 'rescisao_consultoria', 'outro')
  ),
  add column if not exists termination_notes text,
  add column if not exists terminated_at date;
