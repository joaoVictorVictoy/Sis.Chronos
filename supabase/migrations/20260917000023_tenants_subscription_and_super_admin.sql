-- =====================================================================
-- Etapa 23: Controle de Assinaturas (Stripe + Manual) e Super Admin
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Campos de Assinatura e Licenciamento na tabela tenants
-- ---------------------------------------------------------------------
alter table public.tenants
  add column if not exists subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'manual_active', 'suspended')),
  add column if not exists billing_mode text not null default 'manual'
    check (billing_mode in ('stripe', 'manual')),
  add column if not exists plan_tier text not null default 'pro'
    check (char_length(plan_tier) between 1 and 50),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists current_period_end timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists manual_notes text,
  add column if not exists max_users integer check (max_users is null or max_users > 0);

-- Se já existirem empresas de teste/dev criadas anteriormente, marca como manual_active
update public.tenants
set subscription_status = 'manual_active'
where subscription_status = 'trialing' and created_at < now() - interval '1 minute';

-- ---------------------------------------------------------------------
-- 2. Tabela de Super Admins (Dono do SaaS)
-- ---------------------------------------------------------------------
create table if not exists public.super_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists super_admins_email_idx
  on public.super_admins (lower(email));

insert into public.super_admins (email)
values ('joaovvt@gmail.com'), ('joaovictor@binariconsultoria.com.br')
on conflict (lower(email)) do nothing;

alter table public.super_admins enable row level security;

-- ---------------------------------------------------------------------
-- 3. Função para verificar se o usuário autenticado é Super Admin
-- ---------------------------------------------------------------------
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.super_admins sa
    where lower(sa.email) = lower(auth.jwt()->>'email')
  );
$$;

grant execute on function private.is_super_admin() to authenticated;

create policy super_admins_select on public.super_admins
  for select to authenticated
  using (private.is_super_admin());

-- ---------------------------------------------------------------------
-- 4. Atualizar políticas da tabela tenants para permitir que Super Admin veja/edite todas
-- ---------------------------------------------------------------------
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select to authenticated
  using (id = (select private.current_tenant_id()) or (select private.is_super_admin()));

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update to authenticated
  using (
    (id = (select private.current_tenant_id()) and (select private.is_admin()))
    or (select private.is_super_admin())
  )
  with check (
    (id = (select private.current_tenant_id()) and (select private.is_admin()))
    or (select private.is_super_admin())
  );

-- ---------------------------------------------------------------------
-- 5. Atualizar create_tenant para permitir Super Admin criar empresa com e-mail público (ex: @gmail.com)
-- ---------------------------------------------------------------------
create or replace function public.create_tenant(
  p_name text,
  p_cnpj text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_domain text;
  v_tenant_id uuid;
  v_is_super boolean;
  v_domain_to_save text;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Usuário já pertence a uma empresa.' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_uid;
  v_domain := private.email_domain(v_email);
  v_is_super := private.is_super_admin();

  if v_domain is null then
    raise exception 'Não foi possível identificar o domínio do seu e-mail.' using errcode = 'P0001';
  end if;

  if not v_is_super and private.is_public_email_domain(v_domain) then
    raise exception
      'Para criar a empresa use um e-mail corporativo (@suaempresa.com.br). E-mails pessoais como @% não identificam uma empresa.',
      v_domain
      using errcode = 'P0001';
  end if;

  if private.is_public_email_domain(v_domain) then
    v_domain_to_save := null;
  else
    if exists (select 1 from public.tenants t where lower(t.email_domain) = v_domain) then
      raise exception
        'Já existe uma empresa cadastrada com o domínio @%. Peça um convite ao administrador dela.', v_domain
        using errcode = 'P0001';
    end if;
    v_domain_to_save := v_domain;
  end if;

  insert into public.tenants (name, cnpj, email_domain, subscription_status)
  values (
    trim(p_name),
    nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), ''),
    v_domain_to_save,
    case when v_is_super then 'manual_active' else 'trialing' end
  )
  returning id into v_tenant_id;

  insert into public.profiles (id, tenant_id, full_name, email, role)
  values (v_uid, v_tenant_id, trim(p_full_name), lower(v_email), 'admin');

  insert into public.employees (tenant_id, profile_id, full_name, email)
  values (v_tenant_id, v_uid, trim(p_full_name), lower(v_email));

  return v_tenant_id;
end;
$$;
