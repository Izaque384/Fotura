-- Distingue o histórico de visualização da escolha explícita do usuário.
-- Os registros legados eram criados automaticamente e NÃO são opt-outs.
-- Assim, mesmo usuários que já viram um aviso poderão vê-lo novamente.
alter table public.avisos_leituras
  add column if not exists ocultar_permanentemente boolean not null default false;

comment on column public.avisos_leituras.ocultar_permanentemente is
  'Somente verdadeiro quando o próprio usuário escolhe Não mostrar este aviso novamente; visualizações antigas ficam false.';
