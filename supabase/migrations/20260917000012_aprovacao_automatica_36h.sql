-- =====================================================================
-- Etapa 12: Aprovação automática de apontamentos em até 36 horas (Opção C)
-- Se o colaborador apontar em até 36 horas após o término da atividade,
-- o apontamento é aprovado automaticamente. Se passar desse prazo, entra
-- com status 'pendente' aguardando revisão do gestor.
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
  v_is_within_36h boolean;
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
    v_is_within_36h := (now() <= v_entry_end + interval '36 hours' and new.entry_date <= (current_date + interval '1 day'));

    if v_is_within_36h then
      new.status := 'aprovado';
      new.reviewed_at := now();
      new.review_comment := 'Aprovado automaticamente (lançado em até 36h)';
    else
      if new.status = 'aprovado' then
        raise exception 'Novos apontamentos fora do prazo de 36h entram como pendentes.' using errcode = 'P0001';
      end if;
      new.status := 'pendente';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not v_is_manager then
      -- Colaborador pode alterar se ainda estiver pendente, ou se foi auto-aprovado e ainda estiver na janela de 36h
      declare
        v_can_self_edit boolean := false;
        v_old_end timestamptz;
      begin
        v_old_end := (old.entry_date + coalesce(old.end_time, '23:59:59'::time)) at time zone coalesce(nullif(current_setting('timezone', true), ''), 'America/Sao_Paulo');
        if old.status = 'pendente' or (old.status = 'aprovado' and old.reviewed_by is null and now() <= v_old_end + interval '36 hours') then
          v_can_self_edit := true;
        end if;

        if not v_can_self_edit then
          raise exception 'Apontamento já revisado não pode ser alterado.' using errcode = 'P0001';
        end if;
      end;

      if new.status is distinct from old.status
         or new.reviewed_by is distinct from old.reviewed_by
         or new.review_comment is distinct from old.review_comment then
        raise exception 'Apenas gestores podem aprovar ou rejeitar apontamentos.' using errcode = '42501';
      end if;
      if new.employee_id is distinct from old.employee_id then
        raise exception 'Não é possível transferir o apontamento para outra pessoa.' using errcode = '42501';
      end if;

      -- Se alterou a data/hora, reavalia se continua aprovado automaticamente ou fica pendente
      v_entry_end := (new.entry_date + coalesce(new.end_time, '23:59:59'::time)) at time zone coalesce(nullif(current_setting('timezone', true), ''), 'America/Sao_Paulo');
      v_is_within_36h := (now() <= v_entry_end + interval '36 hours' and new.entry_date <= (current_date + interval '1 day'));

      if v_is_within_36h then
        new.status := 'aprovado';
        new.reviewed_at := now();
        new.review_comment := 'Aprovado automaticamente (lançado em até 36h)';
      else
        new.status := 'pendente';
        new.reviewed_at := null;
        new.review_comment := null;
      end if;
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
      if old.status = 'pendente' or (old.status = 'aprovado' and old.reviewed_by is null and now() <= v_old_end + interval '36 hours') then
        v_can_self_delete := true;
      end if;

      if not v_can_self_delete then
        raise exception 'Apontamento já revisado não pode ser excluído.' using errcode = 'P0001';
      end if;
    end;
  end if;

  return old;
end;
$$;
