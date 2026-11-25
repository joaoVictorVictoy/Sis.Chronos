-- =====================================================================
-- 026 · Substitui view public.contract_options por RPC get_contract_options
--
-- Elimina o alerta "Security Definer View" do Security Advisor do Supabase
-- mantendo o isolamento de dados financeiros: colaboradores continuam
-- listando apenas id, nome, cliente e status dos contratos da sua empresa,
-- sem acesso direto a public.contracts (receita, impostos, margem).
-- =====================================================================

create or replace function public.get_contract_options()
returns table (
  id uuid,
  tenant_id uuid,
  client_id uuid,
  name text,
  status public.contract_status,
  start_date date,
  end_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.tenant_id, c.client_id, c.name, c.status, c.start_date, c.end_date
  from public.contracts c
  where c.tenant_id = private.current_tenant_id()
  order by c.name;
$$;

revoke all on function public.get_contract_options() from public, anon;
grant execute on function public.get_contract_options() to authenticated;

drop view if exists public.contract_options;
