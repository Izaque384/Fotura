-- pg_net is platform-owned: do not rely on table ACL changes to protect a
-- long-lived credential. Only short-lived HMAC signatures enter its queue.
create or replace function private.storage_cleanup_authorized(p_token text)
returns boolean language sql security definer set search_path = '' as $$
  select length(p_token)=64 and exists(
    select 1 from vault.decrypted_secrets s cross join generate_series(0,1) age
    where s.name='storage_cleanup_token'
      and p_token=encode(extensions.hmac(
        'fotura-storage-cleanup:' || ((floor(extract(epoch from now())/60)::bigint)-age)::text,
        s.decrypted_secret,'sha256'),'hex')
  );
$$;
revoke all on function private.storage_cleanup_authorized(text) from public,anon,authenticated;
grant execute on function private.storage_cleanup_authorized(text) to service_role;

create or replace function private.dispatch_storage_cleanup()
returns bigint language plpgsql security definer set search_path = '' as $$
declare request_id bigint;
begin
  update public.storage_cleanup_jobs q set status='pending',next_attempt_at=now(),completed_at=null
  where q.status='completed' and exists(select 1 from storage.objects o
    where o.bucket_id='fotos' and o.name like q.prefix || '%');
  if not exists(select 1 from public.storage_cleanup_jobs q
    where (q.status='pending' and q.next_attempt_at<=now())
       or (q.status='processing' and q.lease_until<now())) then return null; end if;
  select net.http_post(
    url := 'https://dwzrrnewznonnoqrffwi.supabase.co/functions/v1/storage-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cleanup-token',
      (select encode(extensions.hmac('fotura-storage-cleanup:' ||
        floor(extract(epoch from now())/60)::bigint::text,decrypted_secret,'sha256'),'hex')
       from vault.decrypted_secrets where name='storage_cleanup_token')),
    body := '{}'::jsonb, timeout_milliseconds := 60000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function private.dispatch_storage_cleanup() from public,anon,authenticated,service_role;

-- Rotate the previous transport credential without returning it to the caller.
do $$ begin
  perform vault.update_secret((select id from vault.secrets where name='storage_cleanup_token'),
    encode(extensions.gen_random_bytes(32),'hex'));
end $$;
