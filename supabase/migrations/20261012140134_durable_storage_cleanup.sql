-- Durable deletion outbox. No FK: jobs must survive project/account deletion.
create table public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  galeria_id uuid not null unique,
  projeto_id uuid,
  prefix text generated always as (user_id::text || '/' || galeria_id::text || '/') stored,
  status text not null default 'pending' check (status in ('pending','processing','completed')),
  attempts integer not null default 0,
  failures integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  completed_at timestamptz
);
alter table public.storage_cleanup_jobs enable row level security;
revoke all on public.storage_cleanup_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.storage_cleanup_jobs to service_role;
create index storage_cleanup_due on public.storage_cleanup_jobs(next_attempt_at)
  where status <> 'completed';

-- The trigger is an internal privileged write, never an exposed RPC.
-- Authorization to delete the gallery remains enforced by existing RLS/RPCs.
create or replace function private.enqueue_gallery_storage_cleanup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.id::text,0));
  insert into public.storage_cleanup_jobs(user_id,galeria_id,projeto_id)
  values(old.user_id,old.id,old.projeto_id);
  return old;
end;
$$;
revoke all on function private.enqueue_gallery_storage_cleanup() from public,anon,authenticated;
create trigger enqueue_gallery_storage_cleanup before delete on public.galerias
for each row execute function private.enqueue_gallery_storage_cleanup();

-- UUID tombstones prevent a restored/reused ID from inheriting a cleanup job.
create or replace function private.prevent_deleted_gallery_reuse()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text,0));
  if exists(select 1 from public.storage_cleanup_jobs where galeria_id=new.id) then
    raise exception 'Deleted gallery identifiers cannot be reused' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_deleted_gallery_reuse() from public,anon,authenticated;
create trigger prevent_deleted_gallery_reuse before insert or update of id on public.galerias
for each row execute function private.prevent_deleted_gallery_reuse();

create or replace function public.storage_cleanup_claim()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare j public.storage_cleanup_jobs;
begin
  select * into j from public.storage_cleanup_jobs q
  where (q.status='pending' and q.next_attempt_at <= now())
     or (q.status='processing' and q.lease_until < now())
  order by q.next_attempt_at,q.created_at for update skip locked limit 1;
  if not found then return null; end if;
  if exists(select 1 from public.galerias where id=j.galeria_id) then
    raise exception 'Refusing cleanup of a live gallery';
  end if;
  update public.storage_cleanup_jobs set status='processing', attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
  where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'lease_token',j.lease_token,'prefix',j.prefix);
end;
$$;

create or replace function public.storage_cleanup_paths(p_id uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare j public.storage_cleanup_jobs; result jsonb;
begin
  select * into j from public.storage_cleanup_jobs where id=p_id and status='processing'
    and lease_token=p_lease and lease_until>now();
  if not found then raise exception 'Cleanup lease expired'; end if;
  if exists(select 1 from public.galerias where id=j.galeria_id) then
    raise exception 'Refusing cleanup of a live gallery';
  end if;
  select coalesce(jsonb_agg(s.name),'[]'::jsonb) into result from (
    select o.name from storage.objects o where o.bucket_id='fotos'
      and o.name like j.prefix || '%' order by o.name limit 500
  ) s;
  return result;
end;
$$;

create or replace function public.storage_cleanup_finish(p_id uuid,p_lease uuid,p_error text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare j public.storage_cleanup_jobs; remaining boolean;
begin
  select * into j from public.storage_cleanup_jobs where id=p_id and status='processing'
    and lease_token=p_lease and lease_until>now() for update;
  if not found then raise exception 'Cleanup lease expired'; end if;
  select exists(select 1 from storage.objects o where o.bucket_id='fotos'
    and o.name like j.prefix || '%') into remaining;
  if not remaining and p_error is null then
    update public.storage_cleanup_jobs set status='completed',completed_at=now(),verified_at=now(),
      last_error=null,lease_token=null,lease_until=null,failures=0 where id=p_id;
    return true;
  end if;
  update public.storage_cleanup_jobs set status='pending',lease_token=null,lease_until=null,
    failures=failures+1, verified_at=now(),
    last_error=left(coalesce(p_error,'Files remain after removal'),250),
    next_attempt_at=now()+make_interval(secs => least(21600,300*power(2,least(j.failures,7)))::integer)
  where id=p_id;
  return false;
end;
$$;

-- Vault access stays private. Only the service role can call the public wrapper.
create or replace function private.storage_cleanup_authorized(p_token text)
returns boolean language sql security definer set search_path = '' as $$
  select length(p_token)=64 and exists(select 1 from vault.decrypted_secrets
    where name='storage_cleanup_token' and decrypted_secret=p_token);
$$;
revoke all on function private.storage_cleanup_authorized(text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.storage_cleanup_authorized(text) to service_role;
create or replace function public.storage_cleanup_authorized(p_token text)
returns boolean language sql security invoker set search_path = '' as $$
  select private.storage_cleanup_authorized(p_token);
$$;

revoke all on function public.storage_cleanup_claim() from public,anon,authenticated;
revoke all on function public.storage_cleanup_paths(uuid,uuid) from public,anon,authenticated;
revoke all on function public.storage_cleanup_finish(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.storage_cleanup_authorized(text) from public,anon,authenticated;
grant execute on function public.storage_cleanup_claim() to service_role;
grant execute on function public.storage_cleanup_paths(uuid,uuid) to service_role;
grant execute on function public.storage_cleanup_finish(uuid,uuid,text) to service_role;
grant execute on function public.storage_cleanup_authorized(text) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
  if not exists(select 1 from vault.secrets where name='storage_cleanup_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'storage_cleanup_token');
  end if;
end $$;

create or replace function private.dispatch_storage_cleanup()
returns bigint language plpgsql security definer set search_path = '' as $$
declare request_id bigint;
begin
  -- Also catch an in-flight upload arriving after a completed deletion. Exact
  -- UUID prefixes only; no broad scan/deletion of unrelated orphaned files.
  update public.storage_cleanup_jobs q set status='pending',next_attempt_at=now(),completed_at=null
  where q.status='completed' and exists(select 1 from storage.objects o
    where o.bucket_id='fotos' and o.name like q.prefix || '%');
  if not exists(select 1 from public.storage_cleanup_jobs q
    where (q.status='pending' and q.next_attempt_at<=now())
       or (q.status='processing' and q.lease_until<now())) then return null; end if;
  select net.http_post(
    url := 'https://dwzrrnewznonnoqrffwi.supabase.co/functions/v1/storage-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cleanup-token',
      (select decrypted_secret from vault.decrypted_secrets where name='storage_cleanup_token')),
    body := '{}'::jsonb, timeout_milliseconds := 60000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function private.dispatch_storage_cleanup() from public,anon,authenticated,service_role;
select cron.schedule('fotura-storage-cleanup','*/5 * * * *','select private.dispatch_storage_cleanup();');
