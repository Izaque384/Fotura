-- Cover the composite gallery/owner foreign key used by selection lists.
create index if not exists selecao_listas_galeria_user_idx
  on public.selecao_listas (galeria, user_id);
