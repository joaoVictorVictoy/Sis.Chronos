-- =====================================================================
-- Etapa 11: Atividades vinculadas ao Cliente
-- Permite que cada cliente tenha suas próprias atividades por área de atuação.
-- =====================================================================

-- 1. Coluna client_id em public.activities
alter table public.activities
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

create index if not exists activities_client_id_idx on public.activities (client_id);
create index if not exists activities_client_area_idx on public.activities (client_id, area_id);

-- 2. Ajuste do índice de unicidade para permitir mesmo nome em clientes diferentes
drop index if exists public.activities_tenant_name_key;

create unique index if not exists activities_tenant_client_area_name_key
  on public.activities (tenant_id, area_id, coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
