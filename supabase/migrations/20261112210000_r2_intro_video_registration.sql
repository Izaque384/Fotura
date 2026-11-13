-- Registration of verified Cloudflare R2 cinematic opening videos.
-- The server must HEAD-check content type, length, and owner/project before calling.
-- This runs in a single SQL transaction together with fair-use accounting.
create or replace function public.registrar_video_r2_upload_backend(
  p_user_id uuid, p_projeto_id uuid, p_path text, p_bytes bigint,
  p_etag text default null
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_user_id is null or p_projeto_id is null or p_path is null or
    p_bytes is null or p_bytes < 1 or p_bytes > 26214400 or
    p_path !~ ('^' || p_user_id::text || '/' || p_projeto_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp4$')
  then return false; end if;
  if not exists(select 1 from public.galeria_projetos p where p.id=p_projeto_id
    and p.user_id=p_user_id) then return false; end if;
  if exists(select 1 from storage.objects s where s.bucket_id='abertura-videos'
    and s.name=p_path and coalesce(s.is_delete_marker,false)=false) then
    return false;
  end if;
  if exists (select 1 from public.fotura_media_objects r
    where r.bucket='abertura-videos' and r.object_key=p_path) then
    return exists(select 1 from public.fotura_media_objects r
      where r.bucket='abertura-videos' and r.object_key=p_path
        and r.owner_id=p_user_id and r.bytes=p_bytes and r.content_type='video/mp4');
  end if;
  if not exists (
    select 1 from public.fotura_r2_upload_reservations q
    where q.bucket='abertura-videos' and q.object_key=p_path
      and q.owner_id=p_user_id and q.thumbnail_key is null
      and q.state='pending' and q.expires_at > now()
    for update
  ) then return false; end if;
  if not public.registrar_video_abertura_upload_backend(
    p_user_id,p_projeto_id,p_path,p_bytes) then return false; end if;
  insert into public.fotura_media_objects
    (bucket,object_key,owner_id,bytes,content_type,etag,verified_at)
  values ('abertura-videos',p_path,p_user_id,p_bytes,'video/mp4',p_etag,now());
  delete from public.fotura_r2_upload_reservations q
  where q.bucket='abertura-videos' and q.object_key=p_path and q.owner_id=p_user_id;
  return true;
end;
$$;
revoke all on function public.registrar_video_r2_upload_backend(uuid,uuid,text,bigint,text)
  from public,anon,authenticated;
grant execute on function public.registrar_video_r2_upload_backend(uuid,uuid,text,bigint,text)
  to service_role;
