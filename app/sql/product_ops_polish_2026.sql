alter table public.galerias
  add column if not exists entrega_publicada_em timestamptz,
  add column if not exists entrega_notificada_em timestamptz;

create or replace function public.admin_upload_fair_use_resumo_backend()
returns table(
  user_id uuid,
  plano_codigo text,
  status text,
  nome_estudio text,
  bytes_enviados bigint,
  arquivos_enviados bigint,
  limite_padrao_bytes bigint,
  limite_override_bytes bigint,
  limite_efetivo_bytes bigint,
  override_expira_em timestamptz,
  override_motivo text
)
language sql
security definer
set search_path = ''
as $function$
  with mes_atual as (
    select date_trunc('month', now() at time zone 'UTC')::date as mes
  )
  select
    a.user_id,
    coalesce(a.plano_codigo, 'sem_plano')::text,
    coalesce(a.status, 'unknown')::text,
    coalesce(pf.nome_estudio, '')::text,
    coalesce(u.bytes_enviados, 0)::bigint,
    coalesce(u.arquivos_enviados, 0)::bigint,
    cfg.limite_mensal_bytes::bigint,
    case
      when ov.user_id is not null and (ov.expira_em is null or ov.expira_em > now())
      then ov.limite_mensal_bytes else null
    end::bigint,
    coalesce(
      case
        when ov.user_id is not null and (ov.expira_em is null or ov.expira_em > now())
        then ov.limite_mensal_bytes else null
      end,
      cfg.limite_mensal_bytes
    )::bigint,
    case
      when ov.user_id is not null and (ov.expira_em is null or ov.expira_em > now())
      then ov.expira_em else null
    end,
    case
      when ov.user_id is not null and (ov.expira_em is null or ov.expira_em > now())
      then ov.motivo else null
    end
  from public.assinaturas a
  left join public.perfis pf on pf.id = a.user_id
  left join private.upload_fair_use_planos cfg on cfg.plano_codigo = a.plano_codigo
  cross join mes_atual m
  left join private.upload_fair_use_mensal u
    on u.user_id = a.user_id and u.mes = m.mes
  left join private.upload_fair_use_overrides ov on ov.user_id = a.user_id
  where cfg.limite_mensal_bytes is not null
  order by
    case
      when coalesce(
        case when ov.user_id is not null and (ov.expira_em is null or ov.expira_em > now())
          then ov.limite_mensal_bytes end,
        cfg.limite_mensal_bytes
      ) > 0
      then coalesce(u.bytes_enviados,0)::numeric /
        coalesce(
          case when ov.user_id is not null and (ov.expira_em is null or ov.expira_em > now())
            then ov.limite_mensal_bytes end,
          cfg.limite_mensal_bytes
        )::numeric
      else 0
    end desc,
    a.user_id;
$function$;

revoke all on function public.admin_upload_fair_use_resumo_backend() from public, anon, authenticated;
grant execute on function public.admin_upload_fair_use_resumo_backend() to service_role;

create or replace function public.admin_definir_upload_fair_use_override_backend(
  p_user_id uuid,
  p_limite_bytes bigint,
  p_expira_em timestamptz default null,
  p_motivo text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null
     or p_limite_bytes is null
     or p_limite_bytes <= 0
     or p_limite_bytes > 10::bigint * 1024 * 1024 * 1024 * 1024 then
    raise exception 'Parâmetros inválidos.' using errcode = '22023';
  end if;

  if p_expira_em is not null and p_expira_em <= now() then
    raise exception 'A expiração precisa estar no futuro.' using errcode = '22023';
  end if;

  insert into private.upload_fair_use_overrides(
    user_id, limite_mensal_bytes, expira_em, motivo, atualizado_em
  )
  values(
    p_user_id,
    p_limite_bytes,
    p_expira_em,
    nullif(left(trim(coalesce(p_motivo,'')),500),''),
    now()
  )
  on conflict (user_id) do update
    set limite_mensal_bytes = excluded.limite_mensal_bytes,
        expira_em = excluded.expira_em,
        motivo = excluded.motivo,
        atualizado_em = now();

  return true;
end;
$function$;

revoke all on function public.admin_definir_upload_fair_use_override_backend(uuid,bigint,timestamptz,text) from public, anon, authenticated;
grant execute on function public.admin_definir_upload_fair_use_override_backend(uuid,bigint,timestamptz,text) to service_role;

create or replace function public.admin_remover_upload_fair_use_override_backend(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null then
    raise exception 'Usuário inválido.' using errcode = '22023';
  end if;
  delete from private.upload_fair_use_overrides where user_id = p_user_id;
  return true;
end;
$function$;

revoke all on function public.admin_remover_upload_fair_use_override_backend(uuid) from public, anon, authenticated;
grant execute on function public.admin_remover_upload_fair_use_override_backend(uuid) to service_role;

create or replace function public.resumo_storage_conta_backend(p_user_id uuid)
returns table(
  galeria_id uuid,
  titulo text,
  etapa text,
  criado_em timestamptz,
  link_ate date,
  storage_limpo boolean,
  bytes_total bigint,
  arquivos_total bigint,
  bytes_entrega bigint,
  arquivos_entrega bigint
)
language sql
security definer
set search_path = ''
as $function$
  select
    g.id,
    coalesce(g.titulo,'Galeria')::text,
    coalesce(g.etapa, case when g.prova then 'prova' else 'entrega' end)::text,
    g.criado_em,
    g.link_ate,
    coalesce(g.storage_limpo,false),
    coalesce(sum(
      case
        when coalesce(o.metadata->>'size','') ~ '^[0-9]+$'
        then (o.metadata->>'size')::bigint
        else 0
      end
    ),0)::bigint,
    count(o.id)::bigint,
    coalesce(sum(
      case
        when split_part(o.name,'/',3) = 'entrega'
         and coalesce(o.metadata->>'size','') ~ '^[0-9]+$'
        then (o.metadata->>'size')::bigint
        else 0
      end
    ),0)::bigint,
    count(o.id) filter (where split_part(o.name,'/',3) = 'entrega')::bigint
  from public.galerias g
  left join storage.objects o
    on o.bucket_id = 'fotos'
   and split_part(o.name,'/',1) = p_user_id::text
   and split_part(o.name,'/',2) = g.id::text
   and coalesce(o.is_delete_marker,false) = false
  where g.user_id = p_user_id
  group by g.id,g.titulo,g.etapa,g.criado_em,g.link_ate,g.storage_limpo,g.prova
  order by 7 desc, g.criado_em desc;
$function$;

revoke all on function public.resumo_storage_conta_backend(uuid) from public, anon, authenticated;
grant execute on function public.resumo_storage_conta_backend(uuid) to service_role;
