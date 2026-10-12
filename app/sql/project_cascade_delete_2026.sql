-- Exclusão definitiva de um Projeto e de todas as galerias/pastas relacionadas.
-- A função é chamada somente pelo backend com service_role.
create or replace function public.excluir_projeto_backend(
  p_projeto uuid,
  p_user_id uuid
)
returns uuid[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner uuid;
  v_galerias uuid[] := array[]::uuid[];
begin
  if p_projeto is null or p_user_id is null then
    raise exception 'Parâmetros inválidos.' using errcode = '22023';
  end if;

  select p.user_id into v_owner
  from public.galeria_projetos p
  where p.id = p_projeto
  for update;

  if not found or v_owner <> p_user_id then
    return null;
  end if;

  select coalesce(array_agg(g.id order by g.ordem, g.criado_em), array[]::uuid[])
  into v_galerias
  from public.galerias g
  where g.projeto_id = p_projeto
    and g.user_id = p_user_id;

  -- Remove referências circulares antes de apagar as galerias.
  update public.galeria_projetos
  set capa_galeria_id = null,
      capa_arquivo = null
  where id = p_projeto
    and user_id = p_user_id;

  -- Tabelas legadas sem FK UUID.
  if cardinality(v_galerias) > 0 then
    delete from public.selecoes
    where galeria = any (
      select unnest(v_galerias)::text
    );

    delete from public.senhas
    where galeria = any (
      select unnest(v_galerias)::text
    );

    -- Eventos são derivados e não devem sobreviver à exclusão definitiva.
    delete from public.produto_eventos e
    where e.user_id = p_user_id
      and e.entidade = 'galeria'
      and e.entidade_id in (
        select x.id::text
        from public.galerias x
        where x.id = any(v_galerias)
        union
        select coalesce(nullif(x.slug,''),'galeria') || '-' ||
               left(replace(x.id::text,'-',''),8)
        from public.galerias x
        where x.id = any(v_galerias)
      );
  end if;

  -- FKs em selecao_listas, vendas_fotos e takedowns usam ON DELETE CASCADE.
  delete from public.galerias
  where projeto_id = p_projeto
    and user_id = p_user_id;

  delete from public.galeria_projetos
  where id = p_projeto
    and user_id = p_user_id;

  if not found then
    raise exception 'Não foi possível excluir o projeto.';
  end if;

  return v_galerias;
end;
$$;

revoke all on function public.excluir_projeto_backend(uuid,uuid) from public, anon, authenticated;
grant execute on function public.excluir_projeto_backend(uuid,uuid) to service_role;
