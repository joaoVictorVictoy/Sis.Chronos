-- =====================================================================
-- Etapa 19: Correção de permissões e RLS para atualização de membros por administradores
-- Permite que administradores alterem papel (gestor, colaborador, admin),
-- permissão de ver custos e status ativo de qualquer membro da sua empresa.
-- =====================================================================

-- Concede privilégio de update nas colunas de gerenciamento de membros
grant update (role, can_view_costs, active) on public.profiles to authenticated;

-- Adiciona política explícita de RLS para administradores atualizarem membros da sua empresa
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (
    tenant_id = (select private.current_tenant_id())
    and (select private.is_admin())
  )
  with check (
    tenant_id = (select private.current_tenant_id())
  );

-- Atualiza a função admin_update_member com verificação estrita de row_count
create or replace function public.admin_update_member(
  p_profile_id uuid,
  p_role public.app_role,
  p_can_view_costs boolean,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_target public.profiles;
  v_count integer;
begin
  if not private.is_admin() then
    raise exception 'Apenas administradores podem alterar membros.' using errcode = '42501';
  end if;

  select * into v_target from public.profiles where id = p_profile_id and tenant_id = v_tenant;
  if not found then
    raise exception 'Membro não encontrado.' using errcode = 'P0002';
  end if;

  if v_target.role = 'admin' and v_target.active
     and (p_role <> 'admin' or not p_active)
     and (select count(*) from public.profiles
          where tenant_id = v_tenant and role = 'admin' and active) <= 1 then
    raise exception 'A empresa precisa de pelo menos um administrador ativo.' using errcode = 'P0001';
  end if;

  update public.profiles
  set role = p_role,
      can_view_costs = case when p_role = 'gestor' then p_can_view_costs else false end,
      active = p_active
  where id = p_profile_id and tenant_id = v_tenant;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Não foi possível atualizar o perfil. Verifique as permissões.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.admin_update_member(uuid, public.app_role, boolean, boolean) from public, anon;
grant execute on function public.admin_update_member(uuid, public.app_role, boolean, boolean) to authenticated;
