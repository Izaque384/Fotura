-- Gallery workspace maturity package — additive and backwards-compatible.
-- Adds projects/folders, reusable gallery presets, named favorite lists,
-- advanced download controls, gallery assist and visual watermark settings.

create unique index if not exists galerias_id_user_id_unique
  on public.galerias (id, user_id);

create table if not exists public.galeria_projetos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid null,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  descricao text null check (descricao is null or char_length(descricao) <= 500),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint galeria_projetos_cliente_owner_fk
    foreign key (cliente_id, user_id)
    references public.clientes(id, user_id)
    on delete set null (cliente_id)
);

create unique index if not exists galeria_projetos_id_user_id_unique
  on public.galeria_projetos (id, user_id);
create index if not exists galeria_projetos_user_id_idx
  on public.galeria_projetos (user_id, atualizado_em desc);

alter table public.galeria_projetos enable row level security;
revoke all on table public.galeria_projetos from public, anon;
grant select, insert, update, delete on table public.galeria_projetos to authenticated;
grant select, insert, update, delete on table public.galeria_projetos to service_role;

drop policy if exists "Fotografo ve proprios projetos" on public.galeria_projetos;
create policy "Fotografo ve proprios projetos"
on public.galeria_projetos for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Fotografo cria proprios projetos" on public.galeria_projetos;
create policy "Fotografo cria proprios projetos"
on public.galeria_projetos for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Fotografo atualiza proprios projetos" on public.galeria_projetos;
create policy "Fotografo atualiza proprios projetos"
on public.galeria_projetos for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Fotografo exclui proprios projetos" on public.galeria_projetos;
create policy "Fotografo exclui proprios projetos"
on public.galeria_projetos for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.galeria_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  config jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint galeria_presets_user_nome_unique unique (user_id, nome)
);

create index if not exists galeria_presets_user_id_idx
  on public.galeria_presets (user_id, atualizado_em desc);

alter table public.galeria_presets enable row level security;
revoke all on table public.galeria_presets from public, anon;
grant select, insert, update, delete on table public.galeria_presets to authenticated;
grant select, insert, update, delete on table public.galeria_presets to service_role;

drop policy if exists "Fotografo ve proprios presets" on public.galeria_presets;
create policy "Fotografo ve proprios presets"
on public.galeria_presets for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Fotografo cria proprios presets" on public.galeria_presets;
create policy "Fotografo cria proprios presets"
on public.galeria_presets for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Fotografo atualiza proprios presets" on public.galeria_presets;
create policy "Fotografo atualiza proprios presets"
on public.galeria_presets for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Fotografo exclui proprios presets" on public.galeria_presets;
create policy "Fotografo exclui proprios presets"
on public.galeria_presets for delete
to authenticated
using ((select auth.uid()) = user_id);

alter table public.galerias
  add column if not exists projeto_id uuid null,
  add column if not exists download_ativo boolean not null default true,
  add column if not exists download_individual boolean not null default true,
  add column if not exists download_completo boolean not null default true,
  add column if not exists download_tamanho text not null default 'original',
  add column if not exists download_pin_hash text null,
  add column if not exists watermark_ativo boolean not null default false,
  add column if not exists watermark_texto text null,
  add column if not exists watermark_opacidade smallint not null default 22,
  add column if not exists assistente_ativo boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'galerias_download_tamanho_check'
  ) then
    alter table public.galerias
      add constraint galerias_download_tamanho_check
      check (download_tamanho in ('original','web'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'galerias_watermark_opacidade_check'
  ) then
    alter table public.galerias
      add constraint galerias_watermark_opacidade_check
      check (watermark_opacidade between 5 and 70);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'galerias_watermark_texto_check'
  ) then
    alter table public.galerias
      add constraint galerias_watermark_texto_check
      check (watermark_texto is null or char_length(watermark_texto) <= 80);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'galerias_projeto_owner_fk'
  ) then
    alter table public.galerias
      add constraint galerias_projeto_owner_fk
      foreign key (projeto_id, user_id)
      references public.galeria_projetos(id, user_id);
  end if;
end $$;

create index if not exists galerias_projeto_id_idx
  on public.galerias (projeto_id)
  where projeto_id is not null;

create table if not exists public.selecao_listas (
  id uuid primary key default gen_random_uuid(),
  galeria uuid not null,
  user_id uuid not null,
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  fotos text[] not null default '{}'::text[],
  comentarios jsonb not null default '{}'::jsonb,
  finalizada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint selecao_listas_galeria_owner_fk
    foreign key (galeria, user_id)
    references public.galerias(id, user_id)
    on delete cascade,
  constraint selecao_listas_galeria_nome_unique unique (galeria, nome)
);

create index if not exists selecao_listas_galeria_idx
  on public.selecao_listas (galeria, atualizado_em desc);
create index if not exists selecao_listas_user_id_idx
  on public.selecao_listas (user_id, atualizado_em desc);

alter table public.selecao_listas enable row level security;
revoke all on table public.selecao_listas from public, anon;
grant select, insert, update, delete on table public.selecao_listas to authenticated;
grant select, insert, update, delete on table public.selecao_listas to service_role;

drop policy if exists "Fotografo ve listas das proprias galerias" on public.selecao_listas;
create policy "Fotografo ve listas das proprias galerias"
on public.selecao_listas for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Fotografo cria listas nas proprias galerias" on public.selecao_listas;
create policy "Fotografo cria listas nas proprias galerias"
on public.selecao_listas for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Fotografo atualiza listas das proprias galerias" on public.selecao_listas;
create policy "Fotografo atualiza listas das proprias galerias"
on public.selecao_listas for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Fotografo exclui listas das proprias galerias" on public.selecao_listas;
create policy "Fotografo exclui listas das proprias galerias"
on public.selecao_listas for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists produto_eventos_entidade_criado_em_idx
  on public.produto_eventos (entidade, entidade_id, criado_em desc)
  where entidade_id is not null;
