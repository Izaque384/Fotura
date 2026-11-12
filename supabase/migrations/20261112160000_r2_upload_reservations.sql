-- R2 upload reservations track synthetically allocated keys BEFORE their signed
-- PUT URLs are exposed. A later worker may only clean expired unconfirmed keys.
-- No existing user files are touched by creating this table.
create table public.fotura_r2_upload_reservations (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('fotos','abertura-videos')),
  object_key text not null,
  thumbnail_key text,
  owner_id uuid not null references auth.users(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending','cleaning')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  upload_id text,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  unique (bucket,object_key),
  constraint r2_pending_owner_scope check (
    split_part(object_key,'/',1)=owner_id::text and
    (thumbnail_key is null or split_part(thumbnail_key,'/',1)=owner_id::text)
  ),
  constraint r2_pending_path_scope check (
    object_key !~ '[[:cntrl:]]' and object_key !~ '(^/|//|/\.\./|/\./|/\.\.$|/\.$)' and
    (thumbnail_key is null or
      (thumbnail_key !~ '[[:cntrl:]]' and
       thumbnail_key !~ '(^/|//|/\.\./|/\./|/\.\.$|/\.$)'))
  ),
  constraint r2_pending_bucket_thumb check (
    (bucket='fotos' and thumbnail_key is not null) or
    (bucket='abertura-videos' and thumbnail_key is null)
  ),
  constraint r2_pending_expiry check (expires_at > created_at)
);
create index fotura_r2_pending_due_idx
  on public.fotura_r2_upload_reservations (expires_at, created_at)
  where state='pending';
alter table public.fotura_r2_upload_reservations enable row level security;
revoke all on public.fotura_r2_upload_reservations from public,anon,authenticated;
grant select,insert,update,delete on public.fotura_r2_upload_reservations to service_role;

comment on table public.fotura_r2_upload_reservations is
  'Server-only R2 uploads awaiting verification. Do not clean until ticket expiry + grace; never delete registered media.';
