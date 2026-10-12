-- Pastas podem ter capa própria; a capa do projeto continua como fallback.
-- Aplicar após project_shared_cover_guard_2026.sql.
drop trigger if exists trg_bloquear_capa_individual_pasta on public.galerias;

-- Alterar configurações do projeto deve preservar as capas das pastas.
-- Mantém a etapa legada coerente ao alterar o modo do Projeto.
create or replace function public.sincronizar_config_pastas_projeto()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.galerias
  set
    cliente_id = new.cliente_id,
    prova = new.prova,
    etapa = case
      when new.prova = false then 'entrega'
      when galerias.etapa in ('selecao_finalizada','preparando_entrega','entrega') then galerias.etapa
      else 'prova'
    end,
    limite = new.limite,
    prazo = new.prazo,
    link_ate = new.link_ate,
    tem_senha = new.tem_senha,
    venda_extras_ativa = new.venda_extras_ativa,
    preco_foto_extra_centavos = new.preco_foto_extra_centavos,
    download_ativo = new.download_ativo,
    download_individual = new.download_individual,
    download_completo = new.download_completo,
    download_tamanho = new.download_tamanho,
    download_pin_hash = new.download_pin_hash,
    watermark_ativo = new.watermark_ativo,
    watermark_texto = new.watermark_texto,
    watermark_opacidade = new.watermark_opacidade,
    assistente_ativo = new.assistente_ativo
  where projeto_id = new.id
    and user_id = new.user_id;

  return new;
end;
$$;

revoke all on function public.sincronizar_config_pastas_projeto() from public, anon, authenticated;
grant execute on function public.sincronizar_config_pastas_projeto() to service_role;

create or replace function public.aplicar_config_projeto_na_pasta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p public.galeria_projetos%rowtype;
begin
  if new.projeto_id is null then
    return new;
  end if;

  select * into p
  from public.galeria_projetos
  where id = new.projeto_id
    and user_id = new.user_id;

  if not found then
    raise exception 'Projeto não encontrado ou não pertence ao usuário.' using errcode='23503';
  end if;

  new.cliente_id := p.cliente_id;
  new.prova := p.prova;
  new.etapa := case when p.prova then 'prova' else 'entrega' end;
  new.limite := p.limite;
  new.prazo := p.prazo;
  new.link_ate := p.link_ate;
  new.tem_senha := p.tem_senha;
  new.venda_extras_ativa := p.venda_extras_ativa;
  new.preco_foto_extra_centavos := p.preco_foto_extra_centavos;
  new.download_ativo := p.download_ativo;
  new.download_individual := p.download_individual;
  new.download_completo := p.download_completo;
  new.download_tamanho := p.download_tamanho;
  new.download_pin_hash := p.download_pin_hash;
  new.watermark_ativo := p.watermark_ativo;
  new.watermark_texto := p.watermark_texto;
  new.watermark_opacidade := p.watermark_opacidade;
  new.assistente_ativo := p.assistente_ativo;
  return new;
end;
$$;


revoke all on function public.aplicar_config_projeto_na_pasta() from public, anon, authenticated;
grant execute on function public.aplicar_config_projeto_na_pasta() to service_role;
