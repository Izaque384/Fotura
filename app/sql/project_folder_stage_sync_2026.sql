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
    assistente_ativo = new.assistente_ativo,
    capa = null
  where projeto_id = new.id
    and user_id = new.user_id;

  return new;
end;
$$;

revoke all on function public.sincronizar_config_pastas_projeto() from public, anon, authenticated;
grant execute on function public.sincronizar_config_pastas_projeto() to service_role;
