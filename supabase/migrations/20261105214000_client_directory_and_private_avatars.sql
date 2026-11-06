
-- Diretório de clientes Fotura: foto privada, observações e etiquetas.
alter table public.clientes
  add column if not exists avatar_path text,
  add column if not exists observacoes text not null default '',
  add column if not exists etiquetas text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_avatar_path_owner' and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes add constraint clientes_avatar_path_owner
    check (
      avatar_path is null or (
        char_length(avatar_path) <= 260
        and avatar_path like user_id::text || '/%'
      )
    );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_observacoes_size' and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes add constraint clientes_observacoes_size
    check (char_length(observacoes) <= 2000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_etiquetas_size' and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes add constraint clientes_etiquetas_size
    check (cardinality(etiquetas) <= 8);
  end if;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('client-avatars','client-avatars',false,2097152,array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
set public=false, file_size_limit=2097152,
    allowed_mime_types=array['image/webp','image/jpeg','image/png'];

-- Caminho do avatar: <id-do-fotografo>/<id-do-cliente>/<imagem>.webp
-- Cada operador acessa apenas arquivos sob seu próprio id.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='client_avatars_read_owner') then
    create policy client_avatars_read_owner on storage.objects
      for select to authenticated
      using (
        bucket_id='client-avatars'
        and (storage.foldername(name))[1]=(select auth.uid())::text
        and (select private.conta_nao_suspensa((select auth.uid())))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='client_avatars_insert_owner') then
    create policy client_avatars_insert_owner on storage.objects
      for insert to authenticated
      with check (
        bucket_id='client-avatars'
        and (storage.foldername(name))[1]=(select auth.uid())::text
        and storage.extension(name)='webp'
        and exists (
          select 1 from public.clientes c
          where c.user_id=(select auth.uid())
          and c.id::text=(storage.foldername(name))[2]
        )
        and (select private.conta_nao_suspensa((select auth.uid())))
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='client_avatars_delete_owner') then
    create policy client_avatars_delete_owner on storage.objects
      for delete to authenticated
      using (
        bucket_id='client-avatars'
        and (storage.foldername(name))[1]=(select auth.uid())::text
        and (select private.conta_nao_suspensa((select auth.uid())))
      );
  end if;
end $$;
