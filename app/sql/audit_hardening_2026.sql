-- Auditoria de segurança e consistência — 2026-09
-- Consolida os ajustes aplicados ao projeto Supabase do Fotura.

create schema if not exists private;

create or replace function private.conta_nao_suspensa(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select not exists (
    select 1
    from public.admin_suspensoes s
    where s.user_id = p_user_id
      and s.ativa = true
  );
$function$;

revoke all on function private.conta_nao_suspensa(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.conta_nao_suspensa(uuid) to authenticated;

alter policy "clientes_conta_nao_suspensa"
on public.clientes
using ((select private.conta_nao_suspensa((select auth.uid()))))
with check ((select private.conta_nao_suspensa((select auth.uid()))));

alter policy "galerias_conta_nao_suspensa"
on public.galerias
using ((select private.conta_nao_suspensa((select auth.uid()))))
with check ((select private.conta_nao_suspensa((select auth.uid()))));

alter policy "perfis_conta_nao_suspensa"
on public.perfis
using ((select private.conta_nao_suspensa((select auth.uid()))))
with check ((select private.conta_nao_suspensa((select auth.uid()))));

alter policy "push_subscriptions_conta_nao_suspensa"
on public.push_subscriptions
using ((select private.conta_nao_suspensa((select auth.uid()))))
with check ((select private.conta_nao_suspensa((select auth.uid()))));

alter policy "selecoes_conta_nao_suspensa"
on public.selecoes
using ((select private.conta_nao_suspensa((select auth.uid()))))
with check ((select private.conta_nao_suspensa((select auth.uid()))));

alter policy "senhas_conta_nao_suspensa"
on public.senhas
using ((select private.conta_nao_suspensa((select auth.uid()))))
with check ((select private.conta_nao_suspensa((select auth.uid()))));

alter policy "storage_conta_nao_suspensa"
on storage.objects
using (
  bucket_id <> all (array['fotos'::text, 'marca'::text])
  or (select private.conta_nao_suspensa((select auth.uid())))
)
with check (
  bucket_id <> all (array['fotos'::text, 'marca'::text])
  or (select private.conta_nao_suspensa((select auth.uid())))
);

drop function if exists public.conta_nao_suspensa(uuid);

revoke all on function public.forcar_takedown_em_galeria()
  from public, anon, authenticated;

alter function public.configurar_venda_extras_galeria(uuid,boolean,integer)
  security invoker;
alter function public.configurar_venda_extras_galeria(uuid,boolean,integer)
  set search_path to '';
revoke all on function public.configurar_venda_extras_galeria(uuid,boolean,integer)
  from public, anon;
grant execute on function public.configurar_venda_extras_galeria(uuid,boolean,integer)
  to authenticated;

drop policy if exists "Fotografo ve proprias vendas" on public.vendas_fotos;
create policy "Fotografo ve proprias vendas"
on public.vendas_fotos
for select
to authenticated
using (fotografo_id = (select auth.uid()));

drop policy if exists "clientes_own_all" on public.clientes;
create policy "clientes_own_all"
on public.clientes
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "push_own_select" on public.push_subscriptions;
create policy "push_own_select"
on public.push_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "push_own_insert" on public.push_subscriptions;
create policy "push_own_insert"
on public.push_subscriptions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "push_own_delete" on public.push_subscriptions;
create policy "push_own_delete"
on public.push_subscriptions
for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists admin_encerramentos_cancelado_por_idx
  on public.admin_encerramentos(cancelado_por);
create index if not exists admin_encerramentos_confirmado_por_idx
  on public.admin_encerramentos(confirmado_por);
create index if not exists admin_encerramentos_executado_por_idx
  on public.admin_encerramentos(executado_por);
create index if not exists admin_encerramentos_solicitado_por_idx
  on public.admin_encerramentos(solicitado_por);

create index if not exists admin_purges_agendado_por_idx
  on public.admin_purges(agendado_por);
create index if not exists admin_purges_cancelado_por_idx
  on public.admin_purges(cancelado_por);
create index if not exists admin_purges_executado_por_idx
  on public.admin_purges(executado_por);

create index if not exists admin_suspensoes_reativado_por_idx
  on public.admin_suspensoes(reativado_por);
create index if not exists admin_suspensoes_suspenso_por_idx
  on public.admin_suspensoes(suspenso_por);

create index if not exists admin_takedown_galerias_estado_user_id_idx
  on public.admin_takedown_galerias_estado(user_id);

create index if not exists admin_takedowns_publicos_atualizado_por_idx
  on public.admin_takedowns_publicos(atualizado_por);
create index if not exists admin_takedowns_publicos_criado_por_idx
  on public.admin_takedowns_publicos(criado_por);
create index if not exists admin_takedowns_publicos_removido_por_idx
  on public.admin_takedowns_publicos(removido_por);
