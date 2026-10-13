-- Persist lightweight photo metadata without replacing Storage as the source of truth.
create table if not exists public.galeria_foto_metadata (
  galeria_id uuid not null references public.galerias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  variante text not null default 'principal' check (variante in ('principal','entrega')),
  nome text not null check (char_length(nome) between 1 and 500 and position('/' in nome)=0 and position('\\' in nome)=0),
  largura integer null check (largura is null or largura > 0),
  altura integer null check (altura is null or altura > 0),
  bytes bigint null check (bytes is null or bytes >= 0),
  mime_type text null,
  thumb_bytes bigint null check (thumb_bytes is null or thumb_bytes >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (galeria_id, variante, nome)
);

create index if not exists galeria_foto_metadata_owner_gallery_variant_idx
  on public.galeria_foto_metadata (user_id, galeria_id, variante, criado_em);

alter table public.galeria_foto_metadata enable row level security;

drop policy if exists galeria_foto_metadata_owner_select on public.galeria_foto_metadata;
create policy galeria_foto_metadata_owner_select
  on public.galeria_foto_metadata for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists galeria_foto_metadata_owner_insert on public.galeria_foto_metadata;
create policy galeria_foto_metadata_owner_insert
  on public.galeria_foto_metadata for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.galerias g
      where g.id = galeria_id and g.user_id = (select auth.uid())
    )
  );

drop policy if exists galeria_foto_metadata_owner_update on public.galeria_foto_metadata;
create policy galeria_foto_metadata_owner_update
  on public.galeria_foto_metadata for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.galerias g
      where g.id = galeria_id and g.user_id = (select auth.uid())
    )
  );

drop policy if exists galeria_foto_metadata_owner_delete on public.galeria_foto_metadata;
create policy galeria_foto_metadata_owner_delete
  on public.galeria_foto_metadata for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Storage remains authoritative. This RPC lists actual objects and enriches
-- them with persisted dimensions when available.
create or replace function public.listar_fotos_galeria_storage(
  p_galeria uuid,
  p_user uuid,
  p_variante text default 'principal'
)
returns table (
  nome text,
  criado_em timestamptz,
  bytes bigint,
  mime_type text,
  largura integer,
  altura integer,
  thumb_bytes bigint
)
language sql
security definer
set search_path = public, storage
stable
as $$
  select
    case when p_variante = 'entrega' then o.path_tokens[4] else o.path_tokens[3] end as nome,
    o.created_at as criado_em,
    nullif(o.metadata->>'size','')::bigint as bytes,
    coalesce(o.metadata->>'mimetype', o.metadata->>'contentType') as mime_type,
    m.largura,
    m.altura,
    m.thumb_bytes
  from storage.objects o
  left join public.galeria_foto_metadata m
    on m.galeria_id = p_galeria
   and m.user_id = p_user
   and m.variante = p_variante
   and m.nome = case when p_variante = 'entrega' then o.path_tokens[4] else o.path_tokens[3] end
  where o.bucket_id = 'fotos'
    and exists (
      select 1 from public.galerias g
      where g.id = p_galeria and g.user_id = p_user
    )
    and o.path_tokens[1] = p_user::text
    and o.path_tokens[2] = p_galeria::text
    and (
      (
        p_variante = 'principal'
        and array_length(o.path_tokens,1) = 3
        and o.path_tokens[3] not in ('thumbs','entrega')
      )
      or
      (
        p_variante = 'entrega'
        and array_length(o.path_tokens,1) = 4
        and o.path_tokens[3] = 'entrega'
      )
    )
    and o.id is not null
  order by o.created_at asc, o.name asc;
$$;

revoke all on function public.listar_fotos_galeria_storage(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.listar_fotos_galeria_storage(uuid,uuid,text) to service_role;
