-- Stage 1: registry for R2 media copies. No existing storage objects are moved.
-- The legacy Supabase Storage remains the source of truth until verified cutover.
-- RESTRICT on auth user deletion prevents loss of registry rows before R2
-- media is physically and verifiably removed, avoiding orphaned private files.
create table if not exists public.fotura_media_objects (
  bucket text not null check (bucket in ('fotos', 'abertura-videos')),
  object_key text not null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  provider text not null default 'r2' check (provider = 'r2'),
  bytes bigint check (bytes is null or bytes >= 0),
  content_type text,
  etag text,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (bucket, object_key),
  constraint fotura_media_object_owner_prefix
    check (split_part(object_key, '/', 1) = owner_id::text),
  constraint fotura_media_object_path_safety
    check (object_key !~ '[[:cntrl:]]' and object_key !~ '(^/|//|/\.\./|/\./|/\.\.$|/\.$)')
);

create index if not exists fotura_media_objects_owner_idx
  on public.fotura_media_objects (owner_id, created_at desc);

alter table public.fotura_media_objects enable row level security;
revoke all on public.fotura_media_objects from public, anon, authenticated;

comment on table public.fotura_media_objects is
  'Verified private R2 object copies. Service-role only; never an authorization policy for public media access.';
