-- Aplicada no Supabase em 2026-10-30, versão 20261030183825.
-- A navegação continua usando miniaturas de 960px; só a entrega usa originais.
ALTER TABLE public.galeria_projetos ALTER COLUMN download_tamanho SET DEFAULT 'original';
ALTER TABLE public.galerias ALTER COLUMN download_tamanho SET DEFAULT 'original';

-- Mantém permissões, PINs, prova/entrega e os próprios arquivos intactos.
UPDATE public.galeria_projetos SET download_tamanho = 'original' WHERE download_tamanho = 'web';
UPDATE public.galerias SET download_tamanho = 'original' WHERE download_tamanho = 'web';
