-- Fotura: plano grátis + planos diferenciados principalmente por armazenamento.
-- Aplicação coordenada com o release de pricing storage-first.

alter table public.assinaturas
  alter column plano_codigo set default 'gratis';

update public.assinaturas
set plano_codigo = 'gratis',
    status = 'active',
    atualizado_em = now()
where plano_codigo = 'sem_plano'
  and provedor_assinatura_id is null;

create or replace function public.criar_assinatura_padrao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.assinaturas (user_id, plano_codigo, status)
  values (new.id, 'gratis', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

create or replace function public.billing_plan_limit(p_user_id uuid, p_recurso text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plano text;
  v_status text;
begin
  select a.plano_codigo, a.status
    into v_plano, v_status
  from public.assinaturas a
  where a.user_id = p_user_id;

  if v_plano is null
     or v_plano = 'sem_plano'
     or v_status not in ('active','trialing','past_due') then
    return 0;
  end if;

  if p_recurso in ('galerias','clientes')
     and v_plano in ('gratis','legacy','essencial','profissional','studio') then
    return null;
  end if;

  return 0;
end;
$function$;
