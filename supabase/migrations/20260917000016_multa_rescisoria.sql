-- =====================================================================
-- Etapa 16: Multa rescisória e fechamento financeiro de contratos
-- Adiciona termination_penalty a contracts e integra à receita calculada.
-- =====================================================================

alter table public.contracts
  add column if not exists termination_penalty numeric(14, 2) check (
    termination_penalty is null or termination_penalty >= 0
  );

-- Atualiza private.contract_revenue para incluir a multa rescisória extraordinária
-- quando o encerramento tiver data de corte contida no período consultado.
create or replace function private.contract_revenue(
  p_contract_id uuid,
  p_from date,
  p_to date
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.contracts;
  v_start date;
  v_end date;
  v_months numeric;
  v_days numeric;
  v_total_days numeric;
  v_revenue numeric := 0;
  v_cutoff date;
begin
  select * into c from public.contracts where id = p_contract_id;
  if not found then
    return 0;
  end if;

  -- Intersecção entre a vigência do contrato e o período consultado
  v_start := greatest(c.start_date, p_from);
  v_end := least(coalesce(c.end_date, p_to), p_to);
  if v_start <= v_end then
    if c.periodicity = 'projeto' then
      v_total_days := (c.end_date - c.start_date) + 1;
      v_days := (v_end - v_start) + 1;
      v_revenue := round(c.amount * (v_days / v_total_days), 2);
    else
      -- Fração de meses coberta pelo intervalo (dias ÷ dias do mês)
      v_months := private.months_between(v_start, v_end);
      v_revenue := round(c.amount / private.periodicity_months(c.periodicity) * v_months, 2);
    end if;
  end if;

  -- Se o contrato foi encerrado com multa rescisória e a data de corte cai no período, soma à receita
  v_cutoff := coalesce(c.terminated_at, c.end_date);
  if c.termination_penalty is not null and c.termination_penalty > 0
     and v_cutoff is not null and v_cutoff between p_from and p_to then
    v_revenue := v_revenue + c.termination_penalty;
  end if;

  return v_revenue;
end;
$$;
