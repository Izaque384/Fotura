-- Cloudflare R2: extend the existing durable gallery cleanup queue.
-- IMPORTANT: apply only alongside a deployed dual-provider cleanup worker, after
-- public.fotura_media_objects exists. Does not delete any current media.

-- The existing storage_cleanup_paths RPC remains unchanged for old workers.
create or replace function public.storage_cleanup_r2_paths(p_id uuid, p_lease uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  j public.storage_cleanup_jobs;
  result jsonb;
begin
  select * into j from public.storage_cleanup_jobs
    where id=p_id and status='processing' and lease_token=p_lease
      and lease_until>now();
  if not found then raise exception 'Cleanup lease expired'; end if;
  if exists(select 1 from public.galerias where id=j.galeria_id) then
    raise exception 'Refusing cleanup of a live gallery';
  end if;

  select coalesce(jsonb_agg(r.object_key order by r.object_key), '[]'::jsonb)
    into result
  from (
    select object_key from public.fotura_media_objects
    where bucket='fotos' and owner_id=j.user_id
      and object_key like j.prefix || '%'
    order by object_key limit 100
  ) r;
  return result;
end;
$$;

-- Called ONLY after the worker has deleted each R2 object and confirmed HEAD=404.
-- The lease plus prefix guard prevent accidental deletion of another tenant's
-- registry entries. The SQL cannot confirm a remote HEAD: the worker must do so.
create or replace function public.storage_cleanup_r2_ack(
  p_id uuid, p_lease uuid, p_paths jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  j public.storage_cleanup_jobs;
  n integer;
  deleted_count integer := 0;
begin
  select * into j from public.storage_cleanup_jobs
    where id=p_id and status='processing' and lease_token=p_lease
      and lease_until>now() for update;
  if not found then raise exception 'Cleanup lease expired'; end if;
  if exists(select 1 from public.galerias where id=j.galeria_id) then
    raise exception 'Refusing cleanup of a live gallery';
  end if;

  if jsonb_typeof(p_paths) <> 'array' then
    raise exception 'Paths must be an array';
  end if;
  n := jsonb_array_length(p_paths);
  if n < 1 or n > 100 then
    raise exception 'Invalid cleanup batch length';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_paths) item
    where jsonb_typeof(item.value) <> 'string'
      or length(item.value #>> '{}') < length(j.prefix) + 1
      or left(item.value #>> '{}',length(j.prefix)) <> j.prefix
  ) then
    raise exception 'R2 cleanup path outside gallery scope';
  end if;

  delete from public.fotura_media_objects r
  where r.bucket='fotos' and r.owner_id=j.user_id
    and r.object_key like j.prefix || '%'
    and r.object_key in (select jsonb_array_elements_text(p_paths));
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Never mark a gallery clean when a verified R2 copy remains in its prefix.
create or replace function public.storage_cleanup_finish(
  p_id uuid, p_lease uuid, p_error text default null
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare j public.storage_cleanup_jobs; remaining boolean;
begin
  select * into j from public.storage_cleanup_jobs where id=p_id and status='processing'
    and lease_token=p_lease and lease_until>now() for update;
  if not found then raise exception 'Cleanup lease expired'; end if;
  if exists(select 1 from public.galerias where id=j.galeria_id) then
    raise exception 'Refusing cleanup of a live gallery';
  end if;

  select
    exists(select 1 from storage.objects o
      where o.bucket_id='fotos' and o.name like j.prefix || '%')
    or exists(select 1 from public.fotura_media_objects r
      where r.bucket='fotos' and r.owner_id=j.user_id and r.object_key like j.prefix || '%')
  into remaining;
  if not remaining and p_error is null then
    update public.storage_cleanup_jobs
    set status='completed',completed_at=now(),verified_at=now(),last_error=null,
      lease_token=null,lease_until=null,failures=0
    where id=p_id;
    return true;
  end if;
  update public.storage_cleanup_jobs set status='pending',lease_token=null,lease_until=null,
    failures=failures+1,verified_at=now(),
    last_error=left(coalesce(p_error,'Files remain after removal'),250),
    next_attempt_at=now()+make_interval(secs => least(21600,300*power(2,least(j.failures,7)))::integer)
  where id=p_id;
  return false;
end;
$$;

-- Revive completed jobs if a late upload was finalized under a deleted gallery.
-- Keep short-lived HMAC dispatch authorization unchanged.
create or replace function private.dispatch_storage_cleanup()
returns bigint language plpgsql security definer set search_path = '' as $$
declare request_id bigint;
begin
  update public.storage_cleanup_jobs q
    set status='pending',next_attempt_at=now(),completed_at=null
  where q.status='completed'
    and (
      exists(select 1 from storage.objects o
        where o.bucket_id='fotos' and o.name like q.prefix || '%')
      or exists(select 1 from public.fotura_media_objects r
        where r.bucket='fotos' and r.owner_id=q.user_id
          and r.object_key like q.prefix || '%')
    );

  if not exists(select 1 from public.storage_cleanup_jobs q
    where (q.status='pending' and q.next_attempt_at<=now())
       or (q.status='processing' and q.lease_until<now())) then return null; end if;
  select net.http_post(
    url := 'https://dwzrrnewznonnoqrffwi.supabase.co/functions/v1/storage-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cleanup-token',
      (select encode(extensions.hmac('fotura-storage-cleanup:' ||
        floor(extract(epoch from now())/60)::bigint::text,decrypted_secret,'sha256'),'hex')
       from vault.decrypted_secrets where name='storage_cleanup_token')),
    body := '{}'::jsonb,timeout_milliseconds := 60000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function public.storage_cleanup_r2_paths(uuid,uuid) from public,anon,authenticated;
revoke all on function public.storage_cleanup_r2_ack(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.storage_cleanup_r2_paths(uuid,uuid) to service_role;
grant execute on function public.storage_cleanup_r2_ack(uuid,uuid,jsonb) to service_role;

comment on function public.storage_cleanup_r2_ack(uuid,uuid,jsonb) is
  'Service-role-only R2 cleanup acknowledgement, after remote deletion and HEAD verification by the cleanup worker.';
