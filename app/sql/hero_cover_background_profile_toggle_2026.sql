-- Global preference: use each gallery's cover as the gallery hero background.
-- The cover itself is still chosen only inside Gallery management.

alter table public.perfis
  add column if not exists hero_foto_capa_ativo boolean not null default false;

update public.perfis p
set hero_foto_capa_ativo = true
where hero_foto_capa_ativo = false
  and exists (
    select 1
    from public.galerias g
    where g.user_id = p.id
      and g.hero_fundo_foto = true
  );
