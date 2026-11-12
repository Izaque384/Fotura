-- Disposable PostgreSQL fixture for executing the R2-only migrations.
-- This is intentionally NOT a snapshot of production or a substitute for
-- full Supabase integration. No hosted project, secrets, or real media used.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema storage;
create schema private;
create schema extensions;
create schema vault;
create schema net;

create table auth.users (id uuid primary key);
create table public.galeria_projetos (
  id uuid primary key, user_id uuid not null references auth.users(id)
);
create table public.galerias (
  id uuid primary key, user_id uuid not null references auth.users(id),
  projeto_id uuid references public.galeria_projetos(id),
  etapa text not null default 'prova',
  storage_limpo boolean not null default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  metadata jsonb,
  is_delete_marker boolean not null default false,
  unique (bucket_id,name)
);
create table public.galeria_foto_metadata (
  galeria_id uuid not null references public.galerias(id),
  user_id uuid not null references auth.users(id),
  variante text not null,
  nome text not null,
  largura integer,
  altura integer,
  bytes bigint,
  mime_type text,
  thumb_bytes bigint,
  atualizado_em timestamptz not null default now(),
  unique (galeria_id,variante,nome)
);
create table private.upload_fair_use_mensal (
  user_id uuid not null references auth.users(id),
  mes date not null,
  bytes_enviados bigint not null default 0,
  arquivos_enviados bigint not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (user_id,mes)
);
create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tipo text not null,
  categoria text not null,
  assunto text not null,
  mensagem text not null,
  nota smallint,
  pagina_origem text,
  navegador text,
  screenshot_path text,
  screenshot_nome text,
  screenshot_mime text,
  screenshot_bytes bigint,
  status text not null default 'novo',
  admin_nota text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  galeria_id uuid not null,
  projeto_id uuid,
  prefix text generated always as (user_id::text || '/' || galeria_id::text || '/') stored,
  status text not null default 'pending',
  lease_token uuid,
  lease_until timestamptz,
  failures integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  verified_at timestamptz,
  last_error text
);
create table vault.decrypted_secrets (name text, decrypted_secret text);
create function extensions.hmac(text,text,text) returns bytea
language sql as $$ select decode(md5($1 || $2), 'hex') $$;
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)
returns bigint language sql as $$ select 1::bigint $$;
create function public.registrar_video_abertura_upload_backend(
  p_user_id uuid,p_projeto_id uuid,p_path text,p_bytes bigint
) returns boolean language sql as $$
  select exists(select 1 from public.galeria_projetos
    where id=p_projeto_id and user_id=p_user_id) and p_bytes>0
$$;
