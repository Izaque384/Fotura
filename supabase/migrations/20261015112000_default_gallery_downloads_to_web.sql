-- Keep Supabase Free-plan egress sustainable by defaulting client delivery to web-sized files.
-- Original files remain stored and can still be explicitly enabled by the photographer.

alter table public.galeria_projetos
  alter column download_tamanho set default 'web';

alter table public.galerias
  alter column download_tamanho set default 'web';

update public.galeria_projetos
set download_tamanho='web'
where download_tamanho='original';

update public.galerias
set download_tamanho='web'
where download_tamanho='original';
