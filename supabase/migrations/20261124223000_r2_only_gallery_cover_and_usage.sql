-- Final Cloudflare R2 cutover: retain gallery-cover selection and per-gallery
-- billing counters after legacy Supabase Storage objects are removed.
-- No media is deleted and no stored gallery references are altered here.

create or replace function public.definir_capa_galeria(p_galeria uuid, p_arquivo text)
returns boolean
language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_arquivo text := btrim(coalesce(p_arquivo, ''));
  v_etapa text;
  v_prova boolean;
  v_base text;
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  if p_galeria is null or v_arquivo = '' or length(v_arquivo) > 220
    or v_arquivo like '%/%' or position(chr(92) in v_arquivo) > 0 then
    raise exception 'Capa inválida.' using errcode = '22023';
  end if;
  select coalesce(g.etapa, case when g.prova then 'prova' else 'entrega' end), g.prova
  into v_etapa, v_prova
  from public.galerias g
  where g.id = p_galeria and g.user_id = v_uid
  for update;
  if not found then
    raise exception 'Galeria não encontrada.' using errcode = 'P0002';
  end if;
  v_base := v_uid::text || '/' || p_galeria::text;
  if v_etapa = 'entrega' and coalesce(v_prova, false) then
    v_base := v_base || '/entrega';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'fotos' and o.name = v_base || '/' || v_arquivo
      and coalesce(o.is_delete_marker,false) = false
  ) and not exists (
    select 1 from public.fotura_media_objects r
    where r.bucket = 'fotos' and r.owner_id = v_uid
      and r.object_key = v_base || '/' || v_arquivo
      and r.verified_at is not null
  ) then
    raise exception 'Arquivo da capa não encontrado.' using errcode = 'P0002';
  end if;
  update public.galerias set capa = v_arquivo
  where id = p_galeria and user_id = v_uid;
  return true;
end;
$function$;
revoke all on function public.definir_capa_galeria(uuid,text) from public,anon;
grant execute on function public.definir_capa_galeria(uuid,text) to authenticated,service_role;

create or replace function public.billing_gallery_usage_backend(
  p_user_id uuid, p_galeria_id uuid
)
returns table(fotos bigint, armazenamento_bytes bigint)
language sql stable security definer set search_path = ''
as $function$
  with sources as (
    select o.name::text as path,
      coalesce(nullif(o.metadata->>'size','')::bigint,0)::bigint as bytes
    from storage.objects o
    where o.bucket_id = 'fotos'
      and split_part(o.name,'/',1) = p_user_id::text
      and split_part(o.name,'/',2) = p_galeria_id::text
      and coalesce(o.is_delete_marker,false) = false
    union all
    select r.object_key, coalesce(r.bytes,0)::bigint
    from public.fotura_media_objects r
    where r.bucket='fotos' and r.owner_id=p_user_id
      and split_part(r.object_key,'/',2) = p_galeria_id::text
      and not exists (
        select 1 from storage.objects o
        where o.bucket_id='fotos' and o.name=r.object_key
          and coalesce(o.is_delete_marker,false)=false
      )
  )
  select count(*) filter (
    where path not like '%/thumbs/%'
  )::bigint as fotos,
  coalesce(sum(bytes),0)::bigint as armazenamento_bytes
  from sources;
$function$;
revoke all on function public.billing_gallery_usage_backend(uuid,uuid) from public,anon,authenticated;
grant execute on function public.billing_gallery_usage_backend(uuid,uuid) to service_role;
