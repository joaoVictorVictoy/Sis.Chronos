-- =====================================================================
-- Etapa 18: Correção de apontamentos para todos e fluxo de solicitação / aprovação / rejeição de exclusão
-- 1. Qualquer colaborador ou gestor pode corrigir seus apontamentos.
--    Se o colaborador corrigir um apontamento já aprovado/rejeitado,
--    o apontamento volta para status 'pendente' para nova aprovação da gestão.
-- 2. Colaboradores podem solicitar a exclusão de apontamentos já aprovados.
--    Gestores e administradores podem aprovar a exclusão (removendo o apontamento)
--    ou rejeitar a exclusão (mantendo o apontamento ativo).
-- =====================================================================

-- Novas colunas para controle da solicitação de exclusão
alter table public.time_entries
  add column if not exists deletion_requested_at timestamptz default null,
  add column if not exists deletion_reason text default null,
  add column if not exists deletion_requested_by uuid references public.profiles(id) on delete set null default null;

create index if not exists time_entries_deletion_requested_idx
  on public.time_entries (tenant_id, deletion_requested_at)
  where deletion_requested_at is not null;

-- Atualiza a função de regras dos apontamentos
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

      -- Caso 2: Colaborador corrigindo o apontamento
      -- Qualquer colaborador pode corrigir seus apontamentos.
      -- Se foi alterado e era aprovado/rejeitado, ou se está fora de 36h,
      -- volta para 'pendente' solicitando aprovação do gestor/admin!
      declare
        v_old_end timestamptz;
      begin
        v_old_end := (old.entry_date + coalesce(old.end_time, '23:59:59'::time)) at time zone coalesce(nullif(current_setting('timezone', true), ''), 'America/Sao_Paulo');
        v_entry_end := (new.entry_date + coalesce(new.end_time, '23:59:59'::time)) at time zone coalesce(nullif(current_setting('timezone', true), ''), 'America/Sao_Paulo');
        v_is_within_36h := (now() <= v_entry_end + interval '36 hours' and new.entry_date <= (current_date + interval '1 day'));

        if old.reviewed_by is not null or not v_is_within_36h or old.status in ('aprovado', 'rejeitado') then
          new.status := 'pendente';
          new.reviewed_at := null;
          new.reviewed_by := null;
          new.review_comment := 'Revisão solicitada após correção do apontamento';
        else
          new.status := 'aprovado';
          new.reviewed_at := now();
          new.review_comment := 'Aprovado automaticamente (lançado em até 36h)';
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
      -- ou se foi auto-aprovado e ainda estiver dentro do prazo de 36h
      if (old.status = 'pendente' and old.reviewed_by is null)
         or (old.status = 'aprovado' and old.reviewed_by is null and now() <= v_old_end + interval '36 hours') then
        v_can_self_delete := true;
      end if;

      if not v_can_self_delete then
        raise exception 'Apontamentos já aprovados não podem ser excluídos diretamente. Solicite a exclusão para aprovação do gestor.' using errcode = 'P0001';
      end if;
    end;
  end if;

  return old;
end;
$$;

-- ---------------------------------------------------------------------
-- Funções RPC para fluxo de solicitação e revisão de exclusão
-- ---------------------------------------------------------------------

-- 1. Colaborador solicita exclusão de um apontamento
create or replace function public.request_time_entry_deletion(
  p_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_emp uuid := private.current_employee_id();
  v_is_mgr boolean := private.is_manager();
  v_entry_date date;
begin
  select entry_date into v_entry_date
  from public.time_entries
  where id = p_id
    and tenant_id = v_tenant
    and (v_is_mgr or employee_id = v_emp);

  if not found then
    raise exception 'Apontamento não encontrado ou sem permissão.' using errcode = 'P0001';
  end if;

  if private.period_locked(v_entry_date) then
    raise exception 'Período fechado: não é possível solicitar exclusão de apontamentos dessa data.' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Informe o motivo da exclusão.' using errcode = 'P0001';
  end if;

  update public.time_entries
  set deletion_requested_at = now(),
      deletion_reason = trim(p_reason),
      deletion_requested_by = auth.uid()
  where id = p_id
    and tenant_id = v_tenant;
end;
$$;

revoke execute on function public.request_time_entry_deletion(uuid, text) from public, anon;
grant execute on function public.request_time_entry_deletion(uuid, text) to authenticated;

-- 2. Colaborador cancela a própria solicitação de exclusão
create or replace function public.cancel_time_entry_deletion(
  p_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_emp uuid := private.current_employee_id();
  v_is_mgr boolean := private.is_manager();
begin
  update public.time_entries
  set deletion_requested_at = null,
      deletion_reason = null,
      deletion_requested_by = null
  where id = p_id
    and tenant_id = v_tenant
    and (v_is_mgr or employee_id = v_emp);

  if not found then
    raise exception 'Apontamento não encontrado ou sem permissão.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.cancel_time_entry_deletion(uuid) from public, anon;
grant execute on function public.cancel_time_entry_deletion(uuid) to authenticated;

-- 3. Gestor/Administrador aprova ou rejeita a solicitação de exclusão
create or replace function public.review_time_entry_deletion(
  p_ids uuid[],
  p_action text,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_count integer := 0;
begin
  if not private.is_manager() then
    raise exception 'Apenas gestores podem aprovar ou rejeitar solicitações de exclusão.' using errcode = '42501';
  end if;

  if p_action not in ('aprovar', 'rejeitar') then
    raise exception 'Ação inválida. Escolha aprovar ou rejeitar.' using errcode = 'P0001';
  end if;

  if p_action = 'aprovar' then
    delete from public.time_entries
    where id = any(p_ids)
      and tenant_id = v_tenant;
    get diagnostics v_count = row_count;
  else
    update public.time_entries
    set deletion_requested_at = null,
        deletion_reason = null,
        deletion_requested_by = null,
        review_comment = coalesce(p_comment, 'Solicitação de exclusão rejeitada pelo gestor.')
    where id = any(p_ids)
      and tenant_id = v_tenant;
    get diagnostics v_count = row_count;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.review_time_entry_deletion(uuid[], text, text) from public, anon;
grant execute on function public.review_time_entry_deletion(uuid[], text, text) to authenticated;
