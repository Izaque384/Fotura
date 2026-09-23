-- Confirmação automática de vendas de fotos extras e segredo do webhook Connect.

create or replace function public.server_secret(p_name text)
returns text
language sql
security definer
set search_path = 'public','vault'
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
  order by created_at desc
  limit 1
$function$;

revoke all on function public.server_secret(text) from public;
revoke all on function public.server_secret(text) from anon;
revoke all on function public.server_secret(text) from authenticated;
grant execute on function public.server_secret(text) to service_role;

alter table public.vendas_fotos
  add column if not exists metodo_pagamento text,
  add column if not exists ultimo_evento_stripe_id text;

create index if not exists vendas_fotos_status_idx
  on public.vendas_fotos(fotografo_id,status,criado_em desc);

create or replace function public.finalizar_venda_fotos_server(
  p_venda uuid,
  p_session_id text,
  p_payment_intent_id text default null,
  p_event_id text default null,
  p_metodo_pagamento text default null
)
returns table(galeria uuid,fotos text[],qtd_extras integer,valor_total_centavos integer)
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v public.vendas_fotos%rowtype;
  v_comentarios jsonb := '{}'::jsonb;
  v_agora timestamptz := now();
begin
  select * into v
  from public.vendas_fotos
  where id=p_venda and stripe_checkout_session_id=p_session_id
  for update;
  if not found then raise exception 'Venda não encontrada.' using errcode='P0002'; end if;

  if v.status <> 'pago' then
    select coalesce(s.comentarios,'{}'::jsonb) into v_comentarios
    from public.selecoes s where s.galeria=v.galeria;

    insert into public.selecoes(galeria,fotos,finalizada,comentarios,atualizado_em)
    values(v.galeria,v.fotos,true,coalesce(v_comentarios,'{}'::jsonb),v_agora)
    on conflict(galeria) do update set
      fotos=excluded.fotos,
      finalizada=true,
      comentarios=coalesce(public.selecoes.comentarios,'{}'::jsonb),
      atualizado_em=v_agora;

    update public.vendas_fotos set
      status='pago',
      stripe_payment_intent_id=coalesce(p_payment_intent_id,stripe_payment_intent_id),
      metodo_pagamento=coalesce(p_metodo_pagamento,metodo_pagamento),
      ultimo_evento_stripe_id=coalesce(p_event_id,ultimo_evento_stripe_id),
      pago_em=coalesce(pago_em,v_agora),
      atualizado_em=v_agora
    where id=v.id;

    update public.galerias set etapa='selecao_finalizada'
    where id=v.galeria and user_id=v.fotografo_id;
  end if;

  return query select v.galeria,v.fotos,v.qtd_extras,v.valor_total_centavos;
end;
$function$;

revoke all on function public.finalizar_venda_fotos_server(uuid,text,text,text,text) from public;
revoke all on function public.finalizar_venda_fotos_server(uuid,text,text,text,text) from anon;
revoke all on function public.finalizar_venda_fotos_server(uuid,text,text,text,text) from authenticated;
grant execute on function public.finalizar_venda_fotos_server(uuid,text,text,text,text) to service_role;
