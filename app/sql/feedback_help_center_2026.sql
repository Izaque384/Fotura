-- Ajuda e feedback voluntário do Fotura.
-- Aplicado em produção em 2026-09-30.

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('problema','sugestao','feedback')),
  categoria text not null check (categoria in ('galerias','clientes','selecoes','vendas','planos','perfil','conta','outro')),
  assunto text not null check (char_length(assunto) between 3 and 120),
  mensagem text not null check (char_length(mensagem) between 10 and 3000),
  nota smallint null check (nota is null or nota between 1 and 5),
  pagina_origem text null check (pagina_origem is null or char_length(pagina_origem) <= 500),
  navegador text null check (navegador is null or char_length(navegador) <= 500),
  screenshot_path text null,
  screenshot_nome text null,
  screenshot_mime text null,
  screenshot_bytes bigint null check (screenshot_bytes is null or screenshot_bytes >= 0),
  status text not null default 'novo' check (status in ('novo','analisando','planejado','resolvido')),
  admin_nota text null check (admin_nota is null or char_length(admin_nota) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.feedbacks enable row level security;
revoke all on table public.feedbacks from anon, authenticated;

create index if not exists feedbacks_user_id_criado_em_idx
  on public.feedbacks (user_id, criado_em desc);

create index if not exists feedbacks_status_criado_em_idx
  on public.feedbacks (status, criado_em desc);

create index if not exists feedbacks_tipo_criado_em_idx
  on public.feedbacks (tipo, criado_em desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-anexos',
  'feedback-anexos',
  false,
  5242880,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
