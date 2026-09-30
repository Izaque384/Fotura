-- Operational recovery verification snapshot.
-- Applied to production on 2026-09-30.
create or replace function public.operational_recovery_snapshot_backend()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_snapshot jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'database', jsonb_build_object(
      'perfis', (select count(*) from public.perfis),
      'assinaturas', (select count(*) from public.assinaturas),
      'clientes', (select count(*) from public.clientes),
      'galerias', (select count(*) from public.galerias),
      'selecoes', (select count(*) from public.selecoes),
      'vendas_fotos', (select count(*) from public.vendas_fotos),
      'atividade_auditoria', (select count(*) from public.atividade_auditoria)
    ),
    'storage', jsonb_build_object(
      'fotos_objetos', (select count(*) from storage.objects where bucket_id = 'fotos'),
      'fotos_bytes', (select coalesce(sum(coalesce((metadata->>'size')::bigint, 0)), 0) from storage.objects where bucket_id = 'fotos'),
      'marca_objetos', (select count(*) from storage.objects where bucket_id = 'marca'),
      'marca_bytes', (select coalesce(sum(coalesce((metadata->>'size')::bigint, 0)), 0) from storage.objects where bucket_id = 'marca')
    )
  ) into v_snapshot;

  return v_snapshot;
end;
$$;

revoke all on function public.operational_recovery_snapshot_backend() from public, anon, authenticated;
grant execute on function public.operational_recovery_snapshot_backend() to service_role;
