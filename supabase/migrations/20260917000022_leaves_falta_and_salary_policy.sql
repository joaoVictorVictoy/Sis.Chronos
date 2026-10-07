-- =====================================================================
-- Etapa 22: Ampliação de tipos de ausência (Falta / Atestado)
-- e permissão para o colaborador visualizar sua própria remuneração
-- =====================================================================

-- 1. Amplia constraint de tipos de ausência/férias
alter table public.employee_leaves drop constraint if exists employee_leaves_type_check;
alter table public.employee_leaves add constraint employee_leaves_type_check
  check (type in ('ferias', 'recesso', 'folga', 'falta', 'atestado', 'outro'));

-- 2. Permite ao colaborador consultar seu próprio histórico/vigência de salário
create policy employee_costs_select_own on public.employee_costs
  for select to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and employee_id in (select id from public.employees where profile_id = auth.uid())
  );
