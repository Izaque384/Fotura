-- Publicação da capa na imagem Open Graph de links protegidos.
-- O valor padrão impede a exposição de qualquer capa de projetos com senha.
alter table public.galeria_projetos
  add column if not exists og_capa_autorizada boolean not null default false;

comment on column public.galeria_projetos.og_capa_autorizada is
  'Autorização explícita do fotógrafo para mostrar a capa do projeto no Open Graph mesmo quando o link exige senha.';
