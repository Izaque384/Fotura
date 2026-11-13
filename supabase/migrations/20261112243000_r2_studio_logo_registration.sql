-- Stage only: atomic confirmation of a public studio-logo URL backed by
-- a private, verified Cloudflare R2 object. No legacy logos are deleted.
-- This function runs only through service_role after remote PUT + HEAD checks.
create or replace function public.registrar_logo_r2_backend(
  p_user_id uuid,
  p_key text,
  p_bytes bigint,
  p_mime text,
  p_etag text default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ext text;
  v_url text;
begin
  if p_user_id is null or p_key is null or
    p_key !~ ('^' || p_user_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|webp)$') or
    p_bytes is null or p_bytes < 1 or p_bytes > 5242880 or
    p_mime not in ('image/png','image/jpeg','image/webp') then
    raise exception 'Invalid studio logo R2 payload';
  end if;
  v_ext := reverse(split_part(reverse(p_key), '.', 1));
  if (v_ext='png' and p_mime<>'image/png') or
     (v_ext='jpg' and p_mime<>'image/jpeg') or
     (v_ext='webp' and p_mime<>'image/webp') then
    raise exception 'Studio logo extension/MIME mismatch';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'Unknown studio owner';
  end if;
  -- Reservation is row-locked while registering to prevent the pending
  -- cleanup worker from deleting the same key before the DB commit.
  if not exists (
    select 1 from public.fotura_r2_upload_reservations q
    where q.bucket='marca' and q.object_key=p_key
      and q.owner_id=p_user_id and q.thumbnail_key is null
      and q.state='pending' and q.expires_at>now()
    for update
  ) then raise exception 'Studio logo R2 reservation unavailable'; end if;

  v_url := '/api/marca/' || p_key;
  insert into public.fotura_media_objects
    (bucket,object_key,owner_id,bytes,content_type,etag,verified_at)
  values ('marca',p_key,p_user_id,p_bytes,p_mime,p_etag,now());

  insert into public.perfis (id,logo_url,atualizado_em)
  values (p_user_id,v_url,now())
  on conflict (id) do update
    set logo_url=excluded.logo_url, atualizado_em=excluded.atualizado_em;

  delete from public.fotura_r2_upload_reservations q
  where q.bucket='marca' and q.object_key=p_key and q.owner_id=p_user_id;
  return v_url;
end;
$$;
revoke all on function public.registrar_logo_r2_backend(
  uuid,text,bigint,text,text
) from public,anon,authenticated;
grant execute on function public.registrar_logo_r2_backend(
  uuid,text,bigint,text,text
) to service_role;
