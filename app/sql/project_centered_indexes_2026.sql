-- Índices de suporte às relações centrais da arquitetura de Projetos.
create index if not exists galeria_projetos_capa_galeria_idx
  on public.galeria_projetos(capa_galeria_id)
  where capa_galeria_id is not null;

create index if not exists galeria_projetos_cliente_user_idx
  on public.galeria_projetos(cliente_id, user_id)
  where cliente_id is not null;

create index if not exists galerias_projeto_user_idx
  on public.galerias(projeto_id, user_id)
  where projeto_id is not null;
