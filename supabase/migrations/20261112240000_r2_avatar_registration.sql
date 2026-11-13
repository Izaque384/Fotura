-- Atomically bind a verified private R2 client avatar to its owned CRM row.
-- Executes only after server-side HEAD confirms MIME and object size.
create or replace function public.registrar_avatar_r2_backend(
  p_user_id uuid, p_cliente_id uuid, p_key text,
  p_bytes bigint, p_etag text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
begin
  if p_user_id is null or p_cliente_id is null or p_key is null
    or p_key !~ ('^' || p_user_id::text || '/' || p_cliente_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$')
    or p_bytes is null or p_bytes < 1 or p_bytes > 8388608
  then raise exception 'Invalid R2 client avatar'; end if;

  select c.avatar_path into v_old
  from public.clientes c
  where c.id=p_cliente_id and c.user_id=p_user_id for update;
  if not found then raise exception 'Client owner mismatch'; end if;

  if not exists (
    select 1 from public.fotura_r2_upload_reservations q
    where q.bucket='client-avatars' and q.object_key=p_key
      and q.owner_id=p_user_id and q.thumbnail_key is null
      and q.state='pending' and q.expires_at>now()
    for update
  ) then raise exception 'Client avatar upload reservation unavailable'; end if;

  insert into public.fotura_media_objects
    (bucket,object_key,owner_id,bytes,content_type,etag,verified_at)
  values ('client-avatars',p_key,p_user_id,p_bytes,'image/webp',p_etag,now());

  update public.clientes set avatar_path=p_key
  where id=p_cliente_id and user_id=p_user_id;

  delete from public.fotura_r2_upload_reservations q
  where q.bucket='client-avatars' and q.object_key=p_key and q.owner_id=p_user_id;

  return v_old;
end;
$$;
revoke all on function public.registrar_avatar_r2_backend(
  uuid,uuid,text,bigint,text
) from public,anon,authenticated;
grant execute on function public.registrar_avatar_r2_backend(
  uuid,uuid,text,bigint,text
) to service_role;
