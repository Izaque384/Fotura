-- R2 stage 2. REVIEW ONLY until the pilot is ready: no client media is moved.
-- Invokable exclusively by service_role after the server verifies signed R2 HEAD.

create or replace function public.registrar_foto_r2_upload_backend(
  p_user_id uuid,
  p_galeria_id uuid,
  p_variante text,
  p_nome text,
  p_bytes bigint,
  p_thumb_bytes bigint,
  p_mime_type text,
  p_etag text default null,
  p_thumb_etag text default null,
  p_largura integer default null,
  p_altura integer default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_original text;
  v_thumb text;
  v_inserted integer := 0;
begin
  if p_user_id is null or p_galeria_id is null
      or p_variante not in ('principal','entrega')
      or p_nome is null or length(p_nome) < 39 or length(p_nome) > 230
      or p_nome !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]+$'
      or p_bytes is null or p_bytes < 1 or p_bytes > 52428800
      or p_thumb_bytes is null or p_thumb_bytes < 1 or p_thumb_bytes > 4194304
      or p_mime_type not in ('image/jpeg','image/png','image/webp')
      or (p_largura is not null and (p_largura < 1 or p_largura > 50000))
      or (p_altura is not null and (p_altura < 1 or p_altura > 50000))
  then return false; end if;

  if not exists (
    select 1 from public.galerias g
    where g.id = p_galeria_id and g.user_id = p_user_id
      and coalesce(g.storage_limpo,false) = false
      and (p_variante='principal' or g.etapa in ('preparando_entrega','selecao_finalizada','entrega'))
  ) then return false; end if;

  v_base := p_user_id::text || '/' || p_galeria_id::text || '/';
  if p_variante='entrega' then v_base := v_base || 'entrega/'; end if;
  v_original := v_base || p_nome;
  v_thumb := v_base || 'thumbs/' || p_nome;

  -- Reject a filename already used by an original in the legacy provider.
  if exists (
    select 1 from storage.objects o
    where o.bucket_id='fotos' and o.name=v_original
      and coalesce(o.is_delete_marker,false)=false
  ) then return false; end if;

  insert into public.fotura_media_objects
    (bucket,object_key,owner_id,bytes,content_type,etag,verified_at)
  values ('fotos',v_original,p_user_id,p_bytes,p_mime_type,p_etag,now())
  on conflict (bucket,object_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted=0 then
    -- A confirmed retry must not charge a second upload or alter existing media.
    return exists (
      select 1 from public.fotura_media_objects
      where bucket='fotos' and object_key=v_original
        and owner_id=p_user_id and bytes=p_bytes and content_type=p_mime_type
    );
  end if;

  insert into public.fotura_media_objects
    (bucket,object_key,owner_id,bytes,content_type,etag,verified_at)
  values ('fotos',v_thumb,p_user_id,p_thumb_bytes,'image/jpeg',p_thumb_etag,now())
  on conflict (bucket,object_key) do nothing;

  insert into public.galeria_foto_metadata
    (galeria_id,user_id,variante,nome,largura,altura,bytes,mime_type,thumb_bytes,atualizado_em)
  values
    (p_galeria_id,p_user_id,p_variante,p_nome,p_largura,p_altura,p_bytes,p_mime_type,p_thumb_bytes,now())
  on conflict (galeria_id,variante,nome) do update set
    largura=excluded.largura,altura=excluded.altura,bytes=excluded.bytes,
    mime_type=excluded.mime_type,thumb_bytes=excluded.thumb_bytes,atualizado_em=now();

  insert into private.upload_fair_use_mensal
    (user_id,mes,bytes_enviados,arquivos_enviados,atualizado_em)
  values
    (p_user_id,date_trunc('month',now() at time zone 'UTC')::date,p_bytes,1,now())
  on conflict (user_id,mes) do update set
    bytes_enviados=private.upload_fair_use_mensal.bytes_enviados+excluded.bytes_enviados,
    arquivos_enviados=private.upload_fair_use_mensal.arquivos_enviados+1,
    atualizado_em=now();

  return true;
end;
$$;

revoke all on function public.registrar_foto_r2_upload_backend(
 uuid,uuid,text,text,bigint,bigint,text,text,text,integer,integer
) from public, anon, authenticated;
grant execute on function public.registrar_foto_r2_upload_backend(
 uuid,uuid,text,text,bigint,bigint,text,text,text,integer,integer
) to service_role;

-- Nonduplicated R2 bytes contribute to each user's Fotura storage quota.
create or replace function public.r2_only_storage_bytes_backend(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(r.bytes),0)::bigint
  from public.fotura_media_objects r
  where r.owner_id=p_user_id and r.bytes is not null
    and not exists (
      select 1 from storage.objects s
      where s.bucket_id=r.bucket and s.name=r.object_key
        and coalesce(s.is_delete_marker,false)=false
    );
$$;

revoke all on function public.r2_only_storage_bytes_backend(uuid) from public, anon, authenticated;
grant execute on function public.r2_only_storage_bytes_backend(uuid) to service_role;
