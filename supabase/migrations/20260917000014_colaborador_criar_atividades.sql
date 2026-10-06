-- =====================================================================
-- Etapa 14: Permitir que colaboradores criem atividades
-- Permite que colaboradores cadastrem novas atividades para seu tenant,
-- mantendo a edição e exclusão restritas a gestores e administradores.
-- =====================================================================

-- 1. Atualiza política de INSERT na tabela activities
drop policy if exists activities_insert on public.activities;

create policy activities_insert on public.activities
  for insert to authenticated
  with check (tenant_id = (select private.current_tenant_id()));
