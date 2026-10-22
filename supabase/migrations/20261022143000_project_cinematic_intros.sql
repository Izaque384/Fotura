-- Configuração opcional, por projeto, da introdução cinematográfica para o cliente.
-- Valores antigos continuam sem abertura. Dados privados e senhas não são alterados.
alter table public.galeria_projetos
  add column if not exists abertura_config jsonb not null
  default '{"ativo":false,"estilo":"cinematografico","duracao":6,"frase":"Alguns momentos merecem ser revividos.","fotos":[],"versao":"1"}'::jsonb;

alter table public.galeria_projetos
  drop constraint if exists galeria_projetos_abertura_config_object;

alter table public.galeria_projetos
  add constraint galeria_projetos_abertura_config_object
  check (jsonb_typeof(abertura_config) = 'object');

comment on column public.galeria_projetos.abertura_config is
  'Configuração opcional da abertura fotográfica por projeto; as fotos referenciam pastas e arquivos, nunca URLs assinadas.';
