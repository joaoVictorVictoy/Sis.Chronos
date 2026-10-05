-- =====================================================================
-- Etapa 13: Permitir atualização de custo na mesma data inicial
-- Se já existir um custo iniciando na mesma data informada, atualiza
-- o registro existente em vez de bloquear com erro.
-- =====================================================================

create or replace function public.set_employee_cost(
  p_employee_id uuid,
  p_monthly_salary numeric,
  p_charges_percent numeric,
  p_charges_amount numeric,
  p_benefits numeric,
  p_monthly_hours numeric,
  p_valid_from date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_current public.employee_costs;
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem definir custos.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.employees e where e.id = p_employee_id and e.tenant_id = v_tenant) then
    raise exception 'Colaborador não encontrado.' using errcode = 'P0002';
  end if;

  -- Vigência que cobre a data informada
  select * into v_current
  from public.employee_costs c
  where c.employee_id = p_employee_id
    and c.valid_from <= p_valid_from
    and (c.valid_to is null or c.valid_to >= p_valid_from)
  order by c.valid_from desc
  limit 1;

  if found then
    if v_current.valid_from = p_valid_from then
      -- Se a vigência inicia na mesma data, atualiza o registro existente
      update public.employee_costs
      set
        monthly_salary = p_monthly_salary,
        charges_percent = coalesce(p_charges_percent, 0),
        charges_amount = coalesce(p_charges_amount, 0),
        benefits = coalesce(p_benefits, 0),
        monthly_hours = p_monthly_hours
      where id = v_current.id;
      return v_current.id;
    end if;

    -- Fecha a vigência anterior no dia anterior ao novo início
    update public.employee_costs
    set valid_to = p_valid_from - 1
    where id = v_current.id;
  end if;

  insert into public.employee_costs (
    tenant_id, employee_id, monthly_salary, charges_percent, charges_amount,
    benefits, monthly_hours, valid_from
  )
  values (
    v_tenant, p_employee_id, p_monthly_salary, coalesce(p_charges_percent, 0), coalesce(p_charges_amount, 0),
    coalesce(p_benefits, 0), p_monthly_hours, p_valid_from
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.set_employee_cost(uuid, numeric, numeric, numeric, numeric, numeric, date)
  from public, anon;
grant execute on function public.set_employee_cost(uuid, numeric, numeric, numeric, numeric, numeric, date)
  to authenticated;
