-- =====================================================================
-- Etapa 10: Refatoração de módulos
-- 1. Compatibilidade com is_active em clients, areas, activities, employees
-- 2. Coluna client_id em time_entries e vínculo automático de contrato
-- 3. Métricas com Média Diária por dias únicos trabalhados e Hora Média por atividade
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. is_active e sincronização
-- ---------------------------------------------------------------------
alter table public.clients add column if not exists is_active boolean not null default true;
update public.clients set is_active = active where is_active <> active;

alter table public.areas add column if not exists is_active boolean not null default true;
update public.areas set is_active = active where is_active <> active;

alter table public.activities add column if not exists is_active boolean not null default true;
update public.activities set is_active = active where is_active <> active;

alter table public.employees add column if not exists is_active boolean not null default true;
update public.employees set is_active = active where is_active <> active;

create or replace function private.sync_is_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active is distinct from old.active and new.is_active is not distinct from old.is_active then
    new.is_active := new.active;
  elsif new.is_active is distinct from old.is_active and new.active is not distinct from old.active then
    new.active := new.is_active;
  else
    new.is_active := coalesce(new.is_active, new.active, true);
    new.active := new.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_clients_is_active on public.clients;
create trigger sync_clients_is_active before update on public.clients for each row execute function private.sync_is_active();

drop trigger if exists sync_areas_is_active on public.areas;
create trigger sync_areas_is_active before update on public.areas for each row execute function private.sync_is_active();

drop trigger if exists sync_activities_is_active on public.activities;
create trigger sync_activities_is_active before update on public.activities for each row execute function private.sync_is_active();

drop trigger if exists sync_employees_is_active on public.employees;
create trigger sync_employees_is_active before update on public.employees for each row execute function private.sync_is_active();

-- ---------------------------------------------------------------------
-- 2. time_entries: client_id e auto-preenchimento
-- ---------------------------------------------------------------------
alter table public.time_entries add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists time_entries_client_date_idx on public.time_entries (client_id, entry_date);

update public.time_entries t
set client_id = c.client_id
from public.contracts c
where t.contract_id = c.id and t.client_id is null;

create or replace function private.time_entries_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.employee_id is distinct from old.employee_id
     or new.entry_date is distinct from old.entry_date then
    new.cost_per_hour := private.employee_hourly_cost(new.employee_id, new.entry_date);
  end if;

  if tg_op = 'INSERT' or new.activity_id is distinct from old.activity_id then
    new.billable := coalesce(
      (select a.billable from public.activities a where a.id = new.activity_id),
      true
    );
  end if;

  if new.contract_id is not null and new.client_id is null then
    new.client_id := (select c.client_id from public.contracts c where c.id = new.contract_id);
  end if;

  if new.start_time is not null and new.end_time is not null then
    new.minutes := (extract(epoch from (new.end_time - new.start_time)) / 60)::integer;
    if new.minutes <= 0 then
      raise exception 'A hora final precisa ser depois da inicial.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Métricas com dias únicos trabalhados e hora média por atividade
-- ---------------------------------------------------------------------
drop function if exists public.employee_metrics(date, date);
create or replace function public.employee_metrics(p_from date, p_to date)
returns table (
  employee_id uuid,
  employee_name text,
  active boolean,
  available_hours numeric,
  hours numeric,
  billable_hours numeric,
  labor_cost numeric,
  entries_count integer,
  last_entry_date date,
  unique_days integer,
  daily_average numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.full_name,
    e.active,
    coalesce(e.monthly_hours, tn.monthly_hours) * private.months_between(p_from, p_to),
    coalesce(t.hours, 0),
    coalesce(t.billable_hours, 0),
    coalesce(t.labor_cost, 0),
    coalesce(t.entries_count, 0),
    t.last_entry_date,
    coalesce(t.unique_days, 0),
    coalesce(t.daily_average, 0)
  from public.employees e
  join public.tenants tn on tn.id = e.tenant_id
  left join lateral (
    select
      sum(x.minutes) / 60.0 as hours,
      sum(x.minutes) filter (where x.billable) / 60.0 as billable_hours,
      sum(x.cost_amount) as labor_cost,
      count(*)::integer as entries_count,
      max(x.entry_date) as last_entry_date,
      count(distinct x.entry_date)::integer as unique_days,
      case when count(distinct x.entry_date) > 0
        then round((sum(x.minutes) / 60.0) / count(distinct x.entry_date), 2)
        else 0
      end as daily_average
    from public.time_entries x
    where x.employee_id = e.id
      and x.entry_date between p_from and p_to
      and x.status <> 'rejeitado'
  ) t on true
  where e.tenant_id = private.current_tenant_id()
    and private.is_manager()
$$;

revoke execute on function public.employee_metrics(date, date) from public, anon;
grant execute on function public.employee_metrics(date, date) to authenticated;

drop function if exists public.activity_metrics(date, date);
create or replace function public.activity_metrics(p_from date, p_to date)
returns table (
  activity_id uuid,
  activity_name text,
  area_name text,
  billable boolean,
  hours numeric,
  labor_cost numeric,
  entries_count integer,
  avg_hours numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.name,
    coalesce(ar.name, 'Sem área'),
    a.billable,
    sum(t.minutes) / 60.0,
    sum(t.cost_amount),
    count(*)::integer,
    case when count(*) > 0
      then round((sum(t.minutes) / 60.0) / count(*), 2)
      else 0
    end
  from public.time_entries t
  join public.activities a on a.id = t.activity_id
  left join public.areas ar on ar.id = a.area_id
  where t.tenant_id = private.current_tenant_id()
    and private.is_manager()
    and t.entry_date between p_from and p_to
    and t.status <> 'rejeitado'
  group by a.id, a.name, ar.name, a.billable
$$;

revoke execute on function public.activity_metrics(date, date) from public, anon;
grant execute on function public.activity_metrics(date, date) to authenticated;
