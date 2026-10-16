-- =====================================================================
-- Etapa 25: Sincronização automática de nomes entre profiles e employees
-- Mantém profiles.full_name e employees.full_name sempre alinhados.
-- =====================================================================

-- Concede privilégio de update na coluna full_name para perfis autenticados
grant update (full_name) on public.profiles to authenticated;

-- 1. Sincroniza perfis existentes com os nomes da tabela de colaboradores
update public.profiles p
set full_name = e.full_name
from public.employees e
where e.profile_id = p.id
  and e.full_name is not null
  and trim(e.full_name) <> ''
  and p.full_name is distinct from e.full_name;

-- 2. Função de trigger para sincronização bidirecional de nomes
create or replace function private.sync_employee_and_profile_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_TABLE_NAME = 'employees' then
    if NEW.profile_id is not null and (TG_OP = 'INSERT' or OLD.full_name is distinct from NEW.full_name or OLD.profile_id is distinct from NEW.profile_id) then
      update public.profiles
      set full_name = NEW.full_name
      where id = NEW.profile_id and full_name is distinct from NEW.full_name;
    end if;
  elsif TG_TABLE_NAME = 'profiles' then
    if TG_OP = 'UPDATE' and OLD.full_name is distinct from NEW.full_name then
      update public.employees
      set full_name = NEW.full_name
      where profile_id = NEW.id and full_name is distinct from NEW.full_name;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_employee_name on public.employees;
create trigger trg_sync_employee_name
  after insert or update of full_name, profile_id on public.employees
  for each row execute function private.sync_employee_and_profile_name();

drop trigger if exists trg_sync_profile_name on public.profiles;
create trigger trg_sync_profile_name
  after update of full_name on public.profiles
  for each row execute function private.sync_employee_and_profile_name();
