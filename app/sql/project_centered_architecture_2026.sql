-- Fotura: arquitetura centrada em Projetos
-- Projeto = unidade compartilhável/configurável; galerias passam a representar pastas internas.

alter table public.galeria_projetos
  add column if not exists slug text,
  add column if not exists capa_galeria_id uuid,
  add column if not exists capa_arquivo text,
  add column if not exists prova boolean not null default true,
  add column if not exists limite integer not null default 0,
  add column if not exists prazo date,
  add column if not exists link_ate date,
  add column if not exists tem_senha boolean not null default false,
  add column if not exists venda_extras_ativa boolean not null default false,
  add column if not exists preco_foto_extra_centavos integer,
  add column if not exists download_ativo boolean not null default true,
  add column if not exists download_individual boolean not null default true,
  add column if not exists download_completo boolean not null default true,
  add column if not exists download_tamanho text not null default 'original',
  add column if not exists download_pin_hash text,
  add column if not exists watermark_ativo boolean not null default false,
  add column if not exists watermark_texto text,
  add column if not exists watermark_opacidade smallint not null default 22,
  add column if not exists assistente_ativo boolean not null default true,
  add column if not exists config_revisada_em timestamptz;

alter table public.galerias
  add column if not exists ordem integer not null default 0,
  add column if not exists visivel boolean not null default true;

create index if not exists galeria_projetos_slug_idx
  on public.galeria_projetos(slug);

create index if not exists galerias_projeto_ordem_idx
  on public.galerias(projeto_id, ordem, criado_em)
  where projeto_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'galeria_projetos_capa_galeria_fk'
  ) then
    alter table public.galeria_projetos
      add constraint galeria_projetos_capa_galeria_fk
      foreign key (capa_galeria_id) references public.galerias(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'galeria_projetos_limite_check'
  ) then
    alter table public.galeria_projetos
      add constraint galeria_projetos_limite_check
      check (limite >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'galeria_projetos_download_tamanho_check'
  ) then
    alter table public.galeria_projetos
      add constraint galeria_projetos_download_tamanho_check
      check (download_tamanho in ('original','web'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'galeria_projetos_watermark_opacidade_check'
  ) then
    alter table public.galeria_projetos
      add constraint galeria_projetos_watermark_opacidade_check
      check (watermark_opacidade between 5 and 70);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'galerias_ordem_check'
  ) then
    alter table public.galerias
      add constraint galerias_ordem_check
      check (ordem >= 0);
  end if;
end $$;

create table if not exists public.projeto_senhas (
  projeto uuid primary key references public.galeria_projetos(id) on delete cascade,
  senha text not null,
  atualizado_em timestamptz default now()
);

alter table public.projeto_senhas enable row level security;

drop policy if exists "Fotografo gerencia senha dos proprios projetos" on public.projeto_senhas;
create policy "Fotografo gerencia senha dos proprios projetos"
on public.projeto_senhas
for all
to authenticated
using (
  exists (
    select 1
    from public.galeria_projetos p
    where p.id = projeto_senhas.projeto
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.galeria_projetos p
    where p.id = projeto_senhas.projeto
      and p.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.projeto_senhas to authenticated;

create or replace function public.hash_senha_projeto()
returns trigger
language plpgsql
set search_path to 'public', 'extensions'
as $$
begin
  if new.senha is not null
     and new.senha <> ''
     and new.senha !~ '^\$2[aby]\$' then
    new.senha := extensions.crypt(new.senha, extensions.gen_salt('bf', 10));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_senha_projeto on public.projeto_senhas;
create trigger trg_hash_senha_projeto
before insert or update of senha on public.projeto_senhas
for each row execute function public.hash_senha_projeto();

create or replace function public.verificar_senha_projeto(p_projeto uuid, p_senha text)
returns boolean
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  select exists (
    select 1
    from public.projeto_senhas s
    where s.projeto = p_projeto
      and s.senha is not null
      and s.senha = extensions.crypt(p_senha, s.senha)
  );
$$;

revoke all on function public.verificar_senha_projeto(uuid,text) from public;
grant execute on function public.verificar_senha_projeto(uuid,text) to anon, authenticated, service_role;

-- Configurações do Projeto são a fonte de verdade.
-- As colunas equivalentes nas galerias permanecem durante a transição para
-- manter APIs de download/seleção/entrega compatíveis.
create or replace function public.sincronizar_config_pastas_projeto()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.galerias
  set
    cliente_id = new.cliente_id,
    prova = new.prova,
    limite = new.limite,
    prazo = new.prazo,
    link_ate = new.link_ate,
    tem_senha = new.tem_senha,
    venda_extras_ativa = new.venda_extras_ativa,
    preco_foto_extra_centavos = new.preco_foto_extra_centavos,
    download_ativo = new.download_ativo,
    download_individual = new.download_individual,
    download_completo = new.download_completo,
    download_tamanho = new.download_tamanho,
    download_pin_hash = new.download_pin_hash,
    watermark_ativo = new.watermark_ativo,
    watermark_texto = new.watermark_texto,
    watermark_opacidade = new.watermark_opacidade,
    assistente_ativo = new.assistente_ativo,
    capa = null
  where projeto_id = new.id
    and user_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists trg_sincronizar_config_pastas_projeto on public.galeria_projetos;
create trigger trg_sincronizar_config_pastas_projeto
after insert or update of
  cliente_id, prova, limite, prazo, link_ate, tem_senha,
  venda_extras_ativa, preco_foto_extra_centavos,
  download_ativo, download_individual, download_completo, download_tamanho,
  download_pin_hash, watermark_ativo, watermark_texto, watermark_opacidade,
  assistente_ativo
on public.galeria_projetos
for each row execute function public.sincronizar_config_pastas_projeto();

create or replace function public.aplicar_config_projeto_na_pasta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p public.galeria_projetos%rowtype;
begin
  if new.projeto_id is null then
    return new;
  end if;

  select * into p
  from public.galeria_projetos
  where id = new.projeto_id
    and user_id = new.user_id;

  if not found then
    raise exception 'Projeto não encontrado ou não pertence ao usuário.' using errcode='23503';
  end if;

  new.cliente_id := p.cliente_id;
  new.prova := p.prova;
  new.etapa := case when p.prova then 'prova' else 'entrega' end;
  new.limite := p.limite;
  new.prazo := p.prazo;
  new.link_ate := p.link_ate;
  new.tem_senha := p.tem_senha;
  new.venda_extras_ativa := p.venda_extras_ativa;
  new.preco_foto_extra_centavos := p.preco_foto_extra_centavos;
  new.download_ativo := p.download_ativo;
  new.download_individual := p.download_individual;
  new.download_completo := p.download_completo;
  new.download_tamanho := p.download_tamanho;
  new.download_pin_hash := p.download_pin_hash;
  new.watermark_ativo := p.watermark_ativo;
  new.watermark_texto := p.watermark_texto;
  new.watermark_opacidade := p.watermark_opacidade;
  new.assistente_ativo := p.assistente_ativo;
  new.capa := null;
  return new;
end;
$$;

drop trigger if exists trg_aplicar_config_projeto_na_pasta on public.galerias;
create trigger trg_aplicar_config_projeto_na_pasta
before insert or update of projeto_id
on public.galerias
for each row execute function public.aplicar_config_projeto_na_pasta();

-- Projetos que já existam recebem a configuração da primeira pasta associada.
with primeira as (
  select distinct on (g.projeto_id)
    g.projeto_id,
    g.slug,
    g.prova,
    g.limite,
    g.prazo,
    g.link_ate,
    g.tem_senha,
    g.venda_extras_ativa,
    g.preco_foto_extra_centavos,
    g.download_ativo,
    g.download_individual,
    g.download_completo,
    g.download_tamanho,
    g.download_pin_hash,
    g.watermark_ativo,
    g.watermark_texto,
    g.watermark_opacidade,
    g.assistente_ativo
  from public.galerias g
  where g.projeto_id is not null
  order by g.projeto_id, g.criado_em asc
)
update public.galeria_projetos p
set
  slug = coalesce(nullif(p.slug,''), primeira.slug),
  prova = primeira.prova,
  limite = primeira.limite,
  prazo = primeira.prazo,
  link_ate = primeira.link_ate,
  tem_senha = primeira.tem_senha,
  venda_extras_ativa = primeira.venda_extras_ativa,
  preco_foto_extra_centavos = primeira.preco_foto_extra_centavos,
  download_ativo = primeira.download_ativo,
  download_individual = primeira.download_individual,
  download_completo = primeira.download_completo,
  download_tamanho = primeira.download_tamanho,
  download_pin_hash = primeira.download_pin_hash,
  watermark_ativo = primeira.watermark_ativo,
  watermark_texto = primeira.watermark_texto,
  watermark_opacidade = primeira.watermark_opacidade,
  assistente_ativo = primeira.assistente_ativo
from primeira
where p.id = primeira.projeto_id;

-- Toda galeria antiga sem projeto vira uma pasta dentro de um novo projeto.
do $$
declare
  g record;
  v_projeto uuid;
  v_capa text;
begin
  for g in
    select *
    from public.galerias
    where projeto_id is null
    order by criado_em asc
  loop
    select coalesce(
      nullif(g.capa, ''),
      (
        select split_part(o.name, '/', 3)
        from storage.objects o
        where o.bucket_id = 'fotos'
          and o.name like (g.user_id::text || '/' || g.id::text || '/%')
          and cardinality(o.path_tokens) = 3
          and coalesce(o.is_delete_marker, false) = false
        order by o.created_at asc
        limit 1
      )
    )
    into v_capa;

    insert into public.galeria_projetos (
      user_id, cliente_id, nome, descricao, slug,
      capa_galeria_id, capa_arquivo,
      prova, limite, prazo, link_ate, tem_senha,
      venda_extras_ativa, preco_foto_extra_centavos,
      download_ativo, download_individual, download_completo, download_tamanho,
      download_pin_hash, watermark_ativo, watermark_texto, watermark_opacidade,
      assistente_ativo, config_revisada_em,
      criado_em, atualizado_em
    )
    values (
      g.user_id, g.cliente_id, coalesce(nullif(g.titulo,''),'Projeto'), null, g.slug,
      case when v_capa is null then null else g.id end, v_capa,
      g.prova, g.limite, g.prazo, g.link_ate, g.tem_senha,
      g.venda_extras_ativa, g.preco_foto_extra_centavos,
      g.download_ativo, g.download_individual, g.download_completo, g.download_tamanho,
      g.download_pin_hash, g.watermark_ativo, g.watermark_texto, g.watermark_opacidade,
      g.assistente_ativo, g.config_revisada_em,
      g.criado_em, now()
    )
    returning id into v_projeto;

    update public.galerias
    set projeto_id = v_projeto,
        ordem = 0,
        capa = null
    where id = g.id;

    if g.tem_senha then
      insert into public.projeto_senhas(projeto, senha, atualizado_em)
      select v_projeto, s.senha, coalesce(s.atualizado_em, now())
      from public.senhas s
      where s.galeria = g.id::text
      on conflict (projeto) do nothing;
    end if;
  end loop;
end $$;

-- Para projetos previamente agrupados, escolhe uma única capa compartilhada.
update public.galeria_projetos p
set
  capa_galeria_id = escolha.galeria_id,
  capa_arquivo = escolha.arquivo
from lateral (
  select
    g.id as galeria_id,
    coalesce(
      nullif(g.capa,''),
      (
        select split_part(o.name, '/', 3)
        from storage.objects o
        where o.bucket_id='fotos'
          and o.name like (g.user_id::text || '/' || g.id::text || '/%')
          and cardinality(o.path_tokens)=3
          and coalesce(o.is_delete_marker,false)=false
        order by o.created_at asc
        limit 1
      )
    ) as arquivo
  from public.galerias g
  where g.projeto_id = p.id
  order by (g.capa is not null) desc, g.ordem asc, g.criado_em asc
  limit 1
) escolha
where p.capa_arquivo is null
  and escolha.arquivo is not null;

-- Nenhuma pasta mantém capa própria na nova arquitetura.
update public.galerias
set capa = null
where projeto_id is not null;

-- Migra senhas legadas de projetos já agrupados, se existirem.
insert into public.projeto_senhas(projeto, senha, atualizado_em)
select distinct on (g.projeto_id)
  g.projeto_id,
  s.senha,
  coalesce(s.atualizado_em, now())
from public.galerias g
join public.senhas s on s.galeria = g.id::text
where g.projeto_id is not null
  and g.tem_senha = true
order by g.projeto_id, s.atualizado_em desc nulls last
on conflict (projeto) do nothing;

-- Slug é apenas parte legível da referência pública; o ID curto evita colisões.
update public.galeria_projetos
set slug = lower(regexp_replace(coalesce(nullif(slug,''), nome, 'projeto'), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null or btrim(slug) = '';

update public.galeria_projetos
set slug = trim(both '-' from slug)
where slug like '-%' or slug like '%-';

update public.galeria_projetos
set slug = 'projeto'
where slug is null or btrim(slug) = '';
