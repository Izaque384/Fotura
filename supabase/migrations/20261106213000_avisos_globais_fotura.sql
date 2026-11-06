-- Avisos globais do Fotura.
-- Apenas o backend com service_role pode editar, publicar ou apagar.
-- Usuários autenticados leem somente avisos publicados e administram suas próprias leituras.
create table if not exists public.avisos_globais (
  id uuid primary key default gen_random_uuid(),
  titulo varchar(120) not null check (length(btrim(titulo)) between 3 and 120),
  mensagem text not null check (length(btrim(mensagem)) between 3 and 3000),
  tipo text not null default 'informacao' check (tipo in ('informacao','atencao','novidade')),
  ativo boolean not null default false,
  versao integer not null default 1 check (versao > 0),
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  constraint av_globais_publicacao check (not ativo or publicado_em is not null)
);

create table if not exists public.avisos_leituras (
  aviso_id uuid not null references public.avisos_globais(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  versao_lida integer not null check (versao_lida > 0),
  lido_em timestamptz not null default now(),
  primary key (aviso_id,user_id)
);
create index if not exists idx_avisos_globais_publicacao on public.avisos_globais (ativo,publicado_em desc);
create index if not exists idx_avisos_leituras_usuario on public.avisos_leituras (user_id);
alter table public.avisos_globais enable row level security;
alter table public.avisos_leituras enable row level security;

revoke all on table public.avisos_globais from public, anon, authenticated;
revoke all on table public.avisos_leituras from public, anon, authenticated;
grant select on table public.avisos_globais to authenticated;
grant select,insert,update on table public.avisos_leituras to authenticated;
grant all on table public.avisos_globais to service_role;
grant all on table public.avisos_leituras to service_role;

create policy "avisos_globais_published_read" on public.avisos_globais
 for select to authenticated
 using (ativo = true and publicado_em <= now());
create policy "avisos_leituras_own_read" on public.avisos_leituras
 for select to authenticated
 using (user_id = (select auth.uid()));
create policy "avisos_leituras_own_insert" on public.avisos_leituras
 for insert to authenticated
 with check (
  user_id = (select auth.uid())
  and exists (
   select 1 from public.avisos_globais a
   where a.id = aviso_id and a.ativo = true and a.publicado_em <= now()
  )
 );
create policy "avisos_leituras_own_update" on public.avisos_leituras
 for update to authenticated
 using (user_id = (select auth.uid()))
 with check (
  user_id = (select auth.uid())
  and exists (
   select 1 from public.avisos_globais a
   where a.id = aviso_id and a.ativo = true and a.publicado_em <= now()
  )
 );
