-- =====================================================================
-- Etapa 24: Comunicados Globais do Sistema (Super Admin Broadcasts)
-- =====================================================================

create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Aviso Importante',
  message text not null,
  type text not null default 'info' check (type in ('info', 'warning', 'success')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_announcements enable row level security;

-- Qualquer usuário autenticado pode ler o comunicado ativo
drop policy if exists announcements_select on public.system_announcements;
create policy announcements_select on public.system_announcements
  for select to authenticated
  using (true);

-- Apenas Super Admin pode criar, atualizar ou excluir comunicados
drop policy if exists announcements_admin on public.system_announcements;
create policy announcements_admin on public.system_announcements
  for all to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());
