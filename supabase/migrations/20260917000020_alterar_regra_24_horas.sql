-- =====================================================================
-- Etapa 20: Alteração da regra de aprovação/exclusão automática de 36h para 24h
-- 1. Novos apontamentos lançados em até 24 horas são aprovados automaticamente.
--    Apontamentos lançados após 24 horas entram como 'pendente'.
-- 2. Qualquer colaborador pode alterar seus apontamentos. Se for alterado após
--    24h ou já tiver sido revisado/aprovado, volta para 'pendente' para o gestor validar.
-- 3. O colaborador pode apagar diretamente em até 24 horas.
--    Após 24 horas, a exclusão necessita de aprovação do gestor/administrador.
-- =====================================================================

create or replace function private.time_entries_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_manager boolean := private.is_manager();
  v_review_only boolean := false;
  v_entry_end timestamptz;
  v_is_within_24h boolean;
begin
  -- Gestor ainda pode aprovar/rejeitar em período fechado (sem mudar horas)
  if tg_op = 'UPDATE' then
    v_review_only := v_is_manager
      and new.entry_date = old.entry_date
      and new.minutes = old.minutes
      and new.employee_id = old.employee_id
      and new.contract_id is not distinct from old.contract_id
      and new.activity_id = old.activity_id;
  end if;

  if not v_review_only then
    if tg_op = 'DELETE' then
      if private.period_locked(old.entry_date) then
        raise exception 'Período fechado: não é possível excluir apontamentos dessa data.' using errcode = 'P0001';
      end if;
    else
      if private.period_locked(new.entry_date) then
        raise exception 'Período fechado: não é possível lançar ou alterar horas nessa data.' using errcode = 'P0001';
      end if;
      if tg_op = 'UPDATE' and private.period_locked(old.entry_date) then
        raise exception 'Período fechado: não é possível alterar este apontamento.' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' then
    -- Calcula término da atividade com base na data e hora final (ou final do dia)
    v_entry_end := (new.entry_date + coalesce(new.end_time, '23:59:59'::time)) at time zone coalesce(nullif(current_setting('timezone', true), ''), 'America/Sao_Paulo');
    v_is_within_24h := (now() <= v_entry_end + interval '24 hours' and new.entry_date <= (current_date + interval '1 day'));

    if v_is_within_24h then
      new.status := 'aprovado';
      new.reviewed_at := now();
      new.review_comment := 'Aprovado automaticamente (lançado em até 24h)';
    else
      if new.status = 'aprovado' then
        raise exception 'Novos apontamentos fora do prazo de 24h entram como pendentes.' using errcode = 'P0001';
      end if;
      new.status := 'pendente';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not v_is_manager then
      -- Colaborador não pode transferir para outro colaborador
      if new.employee_id is distinct from old.employee_id then
        raise exception 'Não é possível transferir o apontamento para outra pessoa.' using errcode = '42501';
      end if;

      -- Caso 1: Apenas solicitando ou cancelando exclusão (sem alterar campos da atividade/horas)
      if (new.entry_date = old.entry_date
          and new.minutes = old.minutes
          and new.activity_id = old.activity_id
          and new.contract_id is not distinct from old.contract_id
          and new.client_id is not distinct from old.client_id
          and new.start_time is not distinct from old.start_time
          and new.end_time is not distinct from old.end_time
          and new.description is not distinct from old.description) then
        if new.status is distinct from old.status then
          raise exception 'Apenas gestores podem aprovar ou rejeitar apontamentos.' using errcode = '42501';
        end if;
        return new;
      end if;

      -- Caso 2: Colaborador alterando/corrigindo o apontamento
      -- Qualquer colaborador pode corrigir seus apontamentos.
      -- Se foi alterado e era aprovado/rejeitado, ou se está fora de 24h,
      -- volta para 'pendente' solicitando aprovação do gestor/admin!
      declare
        v_old_end timestamptz;
      begin
        v_old_end := (old.entry_date + coalesce(old.end_time, '23:59:59'::time)) at time zone coalesce(nullif(current_setting('timezone', true), ''), 'America/Sao_Paulo');
        v_entry_end := (new.entry_date + coalesce(new.end_time, '23:59:59'::time)) at time zone coalesce(nullif(current_setting('timezone', true), ''), 'America/Sao_Paulo');
        v_is_within_24h := (now() <= v_entry_end + interval '24 hours' and new.entry_date <= (current_date + interval '1 day'));

        if old.reviewed_by is not null or not v_is_within_24h or old.status in ('aprovado', 'rejeitado') then
          new.status := 'pendente';
          new.reviewed_at := null;
          new.reviewed_by := null;
          new.review_comment := 'Revisão solicitada após alteração do apontamento';
        else
          new.status := 'aprovado';
          new.reviewed_at := now();
          new.review_comment := 'Aprovado automaticamente (lançado em até 24h)';
        end if;

        -- Qualquer correção limpa solicitação de exclusão pendente
        new.deletion_requested_at := null;
        new.deletion_reason := null;
        new.deletion_requested_by := null;
      end;
    end if;

    if v_is_manager and new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;

    return new;
  end if;

  -- DELETE
  if not v_is_manager then
    declare
      v_can_self_delete boolean := false;
      v_old_end timestamptz;
    begin
      v_old_end := (old.entry_date + coalesce(old.end_time, '23:59:59'::time)) at time zone coalesce(nullif(current_setting('timezone', true), ''), 'America/Sao_Paulo');
      -- Colaborador pode excluir direto apenas se o apontamento estiver pendente sem revisão do gestor,
      -- ou se foi auto-aprovado e ainda estiver dentro do prazo de 24h
      if (old.status = 'pendente' and old.reviewed_by is null)
         or (old.status = 'aprovado' and old.reviewed_by is null and now() <= v_old_end + interval '24 hours') then
        v_can_self_delete := true;
      end if;

      if not v_can_self_delete then
        raise exception 'Apontamentos com mais de 24 horas requerem aprovação do gestor para exclusão. Solicite a exclusão para o gestor.' using errcode = 'P0001';
      end if;
    end;
  end if;

  return old;
end;
$$;
