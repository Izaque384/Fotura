-- Safe, leased R2 orphan-upload cleanup. Only keys intentionally reserved
-- by the server can be deleted. No bucket-wide scans or wildcard deletes.
-- Workers must verify DELETE with remote HEAD 404 before acknowledging.
alter table public.fotura_r2_upload_reservations
  add column if not exists next_attempt_at timestamptz not null default now();

create or replace function public.r2_pending_cleanup_claim()
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare q public.fotura_r2_upload_reservations;
begin
  select * into q from public.fotura_r2_upload_reservations r
  where (
      (r.state='pending' and r.expires_at < now()-interval '12 hours'
        and r.next_attempt_at <= now())
      or (r.state='cleaning' and r.lease_until < now())
    )
    and not exists (select 1 from public.fotura_media_objects m
      where m.bucket=r.bucket and m.object_key=r.object_key)
  order by r.created_at
  for update skip locked limit 1;
  if not found then return null; end if;

  update public.fotura_r2_upload_reservations
  set state='cleaning',lease_token=gen_random_uuid(),
      lease_until=now()+interval '2 minutes',attempts=attempts+1
  where id=q.id returning * into q;

  return jsonb_build_object(
    'id',q.id,'lease_token',q.lease_token,'bucket',q.bucket,
    'object_key',q.object_key,'thumbnail_key',q.thumbnail_key,
    'upload_id',q.upload_id,'owner_id',q.owner_id
  );
end;
$$;

create or replace function public.r2_pending_cleanup_finish(
  p_id uuid, p_lease uuid, p_success boolean
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare q public.fotura_r2_upload_reservations;
begin
  select * into q from public.fotura_r2_upload_reservations
    where id=p_id and state='cleaning' and lease_token=p_lease
      and lease_until>now() for update;
  if not found then raise exception 'R2 cleanup lease expired'; end if;
  if exists (select 1 from public.fotura_media_objects m
    where m.bucket=q.bucket and m.object_key=q.object_key) then
    raise exception 'Refusing pending cleanup of verified media';
  end if;
  if p_success then
    delete from public.fotura_r2_upload_reservations where id=p_id;
    return true;
  end if;

  update public.fotura_r2_upload_reservations
  set state='pending',lease_token=null,lease_until=null,
      next_attempt_at=now()+make_interval(secs => least(21600,
        60*power(2,least(q.attempts,8)))::integer)
  where id=p_id;
  return false;
end;
$$;

revoke all on function public.r2_pending_cleanup_claim() from public,anon,authenticated;
revoke all on function public.r2_pending_cleanup_finish(uuid,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.r2_pending_cleanup_claim() to service_role;
grant execute on function public.r2_pending_cleanup_finish(uuid,uuid,boolean) to service_role;

-- Existing pg_cron + signed pg_net dispatcher now wakes for expired pending
-- uploads, too. The original authenticated Edge Function endpoint remains.
create or replace function private.dispatch_storage_cleanup()
returns bigint language plpgsql security definer set search_path = ''
as $$
declare request_id bigint;
begin
  update public.storage_cleanup_jobs q set status='pending',
    next_attempt_at=now(),completed_at=null
  where q.status='completed'
    and (
      exists(select 1 from storage.objects o
        where o.bucket_id='fotos' and o.name like q.prefix || '%')
      or exists(select 1 from public.fotura_media_objects r
        where r.bucket='fotos' and r.owner_id=q.user_id
          and r.object_key like q.prefix || '%')
    );
  if not exists(
    select 1 from public.storage_cleanup_jobs q
    where (q.status='pending' and q.next_attempt_at<=now())
       or (q.status='processing' and q.lease_until<now())
  ) and not exists(
    select 1 from public.fotura_r2_upload_reservations r
    where (
      (r.state='pending' and r.expires_at < now()-interval '12 hours'
        and r.next_attempt_at<=now())
      or (r.state='cleaning' and r.lease_until<now())
    ) and not exists(select 1 from public.fotura_media_objects m
      where m.bucket=r.bucket and m.object_key=r.object_key)
  ) then return null; end if;

  select net.http_post(
    url := 'https://dwzrrnewznonnoqrffwi.supabase.co/functions/v1/storage-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cleanup-token',
      (select encode(extensions.hmac('fotura-storage-cleanup:' ||
        floor(extract(epoch from now())/60)::bigint::text,
        decrypted_secret,'sha256'),'hex')
       from vault.decrypted_secrets where name='storage_cleanup_token')),
    body := '{}'::jsonb,timeout_milliseconds := 60000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function private.dispatch_storage_cleanup() from public,anon,authenticated,service_role;
