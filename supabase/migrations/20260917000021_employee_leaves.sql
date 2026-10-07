-- =====================================================================
-- Etapa 21: Registro de Férias e Recesso de Colaboradores
-- Permite registrar períodos de férias/recesso para que não constem como
-- dias úteis sem apontamento e não gerem cobrança indevida de horas.
-- =====================================================================

create table if not exists public.employee_leaves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type text not null default 'ferias' check (type in ('ferias', 'recesso', 'folga', 'outro')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create index if not exists employee_leaves_tenant_emp_dates_idx
  on public.employee_leaves (tenant_id, employee_id, start_date, end_date);

create trigger employee_leaves_set_updated_at
  before update on public.employee_leaves
  for each row execute function private.set_updated_at();

-- RLS
alter table public.employee_leaves enable row level security;
revoke all on public.employee_leaves from anon;

create policy employee_leaves_select on public.employee_leaves
  for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and (
      (select private.is_manager())
      or employee_id = (select private.current_employee_id())
    )
  );

create policy employee_leaves_insert on public.employee_leaves
  for insert to authenticated
  with check (
    tenant_id = (select private.current_tenant_id())
    and (
      (select private.is_manager())
      or employee_id = (select private.current_employee_id())
    )
  );

create policy employee_leaves_update on public.employee_leaves
  for update to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and (
      (select private.is_manager())
      or employee_id = (select private.current_employee_id())
    )
  )
  with check (
    tenant_id = (select private.current_tenant_id())
    and (
      (select private.is_manager())
      or employee_id = (select private.current_employee_id())
    )
  );

create policy employee_leaves_delete on public.employee_leaves
  for delete to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and (
      (select private.is_manager())
      or employee_id = (select private.current_employee_id())
    )
  );
