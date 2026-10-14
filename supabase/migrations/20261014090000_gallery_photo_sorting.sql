alter table public.galerias
  add column if not exists ordem_fotos text not null default 'upload'
  check (ordem_fotos in ('upload','recentes','nome_asc','nome_desc'));

comment on column public.galerias.ordem_fotos is
  'Ordenação pública das fotos: upload, recentes, nome_asc ou nome_desc.';
