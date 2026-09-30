-- Service-only health audit for critical tenant-isolation policies.
create or replace function public.tenant_isolation_audit_backend()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  with expected(tablename, policyname, permissive) as (
    values
      ('perfis','perfis_select_own','PERMISSIVE'),
      ('perfis','Criar meu perfil','PERMISSIVE'),
      ('perfis','Atualizar meu perfil','PERMISSIVE'),
      ('perfis','perfis_conta_nao_suspensa','RESTRICTIVE'),
      ('clientes','clientes_own_all','PERMISSIVE'),
      ('clientes','clientes_conta_nao_suspensa','RESTRICTIVE'),
      ('galerias','galerias_dono_all','PERMISSIVE'),
      ('galerias','galerias_conta_nao_suspensa','RESTRICTIVE'),
      ('selecoes','selecoes_owner_all','PERMISSIVE'),
      ('selecoes','selecoes_conta_nao_suspensa','RESTRICTIVE'),
      ('assinaturas','assinaturas_select_own','PERMISSIVE'),
      ('vendas_fotos','Fotografo ve proprias vendas','PERMISSIVE')
  ),
  checked as (
    select e.tablename,e.policyname,e.permissive as expected_permissive,
           p.policyname is not null as present,p.permissive as actual_permissive
    from expected e
    left join pg_policies p
      on p.schemaname='public' and p.tablename=e.tablename and p.policyname=e.policyname
  )
  select jsonb_build_object(
    'ok', bool_and(present and actual_permissive = expected_permissive),
    'checked', count(*),
    'issues', coalesce(
      jsonb_agg(jsonb_build_object(
        'table',tablename,'policy',policyname,'expected',expected_permissive,
        'actual',coalesce(actual_permissive,'MISSING')
      )) filter (where not present or actual_permissive <> expected_permissive),
      '[]'::jsonb
    )
  )
  from checked;
$$;

revoke all on function public.tenant_isolation_audit_backend() from public, anon, authenticated;
grant execute on function public.tenant_isolation_audit_backend() to service_role;
