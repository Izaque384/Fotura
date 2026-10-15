-- Keep Supabase Free-plan egress sustainable by defaulting client delivery to web-sized files.
alter table public.galerias
  alter column download_tamanho set default 'web';

update public.galerias
set download_tamanho='web'
where download_tamanho='original';
