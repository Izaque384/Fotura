-- Proteção interna de uso justo de uploads.
-- Mantém os limites comerciais como armazenamento simultâneo (1/10/50/100 GB)
-- e adiciona uma barreira mensal de 110% da capacidade do plano contra ciclos artificiais de upload/exclusão.

create table if not exists private.upload_fair_use_planos (
  plano_codigo text primary key,
  limite_mensal_bytes bigint not null check (limite_mensal_bytes > 0),
  atualizado_em timestamptz not null default now()
);

insert into private.upload_fair_use_planos (plano_codigo, limite_mensal_bytes)
values
  ('gratis', (1::bigint * 1024 * 1024 * 1024 * 11) / 10),
  ('essencial', (10::bigint * 1024 * 1024 * 1024 * 11) / 10),
  ('profissional', (50::bigint * 1024 * 1024 * 1024 * 11) / 10),
  ('studio', (100::bigint * 1024 * 1024 * 1024 * 11) / 10),
  ('legacy', 2048::bigint * 1024 * 1024 * 1024)
on conflict (plano_codigo) do update
set limite_mensal_bytes = excluded.limite_mensal_bytes,
    atualizado_em = now();

create table if not exists private.upload_fair_use_mensal (
  user_id uuid not null references auth.users(id) on delete cascade,
  mes date not null,
  bytes_enviados bigint not null default 0 check (bytes_enviados >= 0),
  arquivos_enviados bigint not null default 0 check (arquivos_enviados >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, mes)
);

create table if not exists private.upload_fair_use_overrides (
  user_id uuid primary key references auth.users(id) on delete cascade,
  limite_mensal_bytes bigint not null check (limite_mensal_bytes > 0),
  expira_em timestamptz null,
  motivo text null check (motivo is null or char_length(motivo) <= 500),
  atualizado_em timestamptz not null default now()
);

revoke all on table private.upload_fair_use_planos from public, anon, authenticated;
revoke all on table private.upload_fair_use_mensal from public, anon, authenticated;
revoke all on table private.upload_fair_use_overrides from public, anon, authenticated;

create index if not exists upload_fair_use_mensal_mes_idx
  on private.upload_fair_use_mensal (mes);

create or replace function private.billing_storage_insert_allowed(
  p_name text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_parts text[] := storage.foldername(p_name);
  v_gallery uuid;
  v_plan text;
  v_status text;
  v_storage_limit_gb integer;
  v_current_bytes bigint;
  v_new_bytes bigint := 0;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_monthly_limit bigint;
  v_monthly_after bigint;
  v_counted text;
begin
  if v_uid is null then return false; end if;
  if array_length(v_parts,1) < 2 or v_parts[1] <> v_uid::text then return false; end if;

  begin
    v_gallery := v_parts[2]::uuid;
  exception when others then
    return false;
  end;

  if not exists (
    select 1 from public.galerias g
    where g.id = v_gallery and g.user_id = v_uid
  ) then return false; end if;

  if coalesce(p_metadata->>'size','') ~ '^[0-9]+$' then
    v_new_bytes := (p_metadata->>'size')::bigint;
  elsif coalesce(p_metadata->>'contentLength','') ~ '^[0-9]+$' then
    v_new_bytes := (p_metadata->>'contentLength')::bigint;
  else
    return false;
  end if;

  if v_new_bytes <= 0 then return false; end if;

  select a.plano_codigo, a.status into v_plan, v_status
  from public.assinaturas a where a.user_id = v_uid;

  if v_plan is null or v_plan = 'sem_plano'
     or v_status not in ('active','trialing','past_due') then
    return false;
  end if;

  v_storage_limit_gb := case v_plan
    when 'gratis' then 1
    when 'essencial' then 10
    when 'profissional' then 50
    when 'studio' then 100
    when 'legacy' then null
    else 0
  end;

  if v_plan <> 'legacy' and coalesce(v_storage_limit_gb,0) <= 0 then
    return false;
  end if;

  select coalesce(
    (select o.limite_mensal_bytes
       from private.upload_fair_use_overrides o
      where o.user_id = v_uid
        and (o.expira_em is null or o.expira_em > now())),
    (select p.limite_mensal_bytes
       from private.upload_fair_use_planos p
      where p.plano_codigo = v_plan)
  ) into v_monthly_limit;

  if v_monthly_limit is null or v_monthly_limit <= 0
     or v_new_bytes > v_monthly_limit then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':billing:storage', 0));

  if v_plan <> 'legacy' then
    select coalesce(sum(
      case when coalesce(o.metadata->>'size','') ~ '^[0-9]+$'
        then (o.metadata->>'size')::bigint else 0 end
    ),0)
    into v_current_bytes
    from storage.objects o
    where o.bucket_id = 'fotos'
      and (storage.foldername(o.name))[1] = v_uid::text;

    if v_current_bytes + v_new_bytes
       > v_storage_limit_gb::bigint * 1024 * 1024 * 1024 then
      return false;
    end if;
  end if;

  v_counted := current_setting('fotura.upload_fair_use_counted', true);

  if v_counted is distinct from '1' then
    insert into private.upload_fair_use_mensal as u
      (user_id, mes, bytes_enviados, arquivos_enviados, atualizado_em)
    values (v_uid, v_month, v_new_bytes, 1, now())
    on conflict (user_id, mes) do update
      set bytes_enviados = u.bytes_enviados + excluded.bytes_enviados,
          arquivos_enviados = u.arquivos_enviados + 1,
          atualizado_em = now()
      where u.bytes_enviados + excluded.bytes_enviados <= v_monthly_limit
    returning bytes_enviados into v_monthly_after;

    if v_monthly_after is null then return false; end if;
    perform set_config('fotura.upload_fair_use_counted', '1', true);
  end if;

  return true;
end;
$function$;

revoke all on function private.billing_storage_insert_allowed(text,jsonb) from public, anon;
grant execute on function private.billing_storage_insert_allowed(text,jsonb) to authenticated;

create or replace function public.status_uso_justo_upload_backend(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_plan text;
  v_status text;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_used bigint := 0;
  v_limit bigint;
  v_reset timestamptz := (
    date_trunc('month', now() at time zone 'UTC') + interval '1 month'
  ) at time zone 'UTC';
begin
  select a.plano_codigo, a.status into v_plan, v_status
  from public.assinaturas a where a.user_id = p_user_id;

  if v_plan is null or v_plan = 'sem_plano'
     or v_status not in ('active','trialing','past_due') then
    return jsonb_build_object('bloqueado', false, 'reinicia_em', v_reset);
  end if;

  select coalesce(
    (select o.limite_mensal_bytes
       from private.upload_fair_use_overrides o
      where o.user_id = p_user_id
        and (o.expira_em is null or o.expira_em > now())),
    (select p.limite_mensal_bytes
       from private.upload_fair_use_planos p
      where p.plano_codigo = v_plan)
  ) into v_limit;

  select coalesce(u.bytes_enviados,0) into v_used
  from private.upload_fair_use_mensal u
  where u.user_id = p_user_id and u.mes = v_month;

  return jsonb_build_object(
    'bloqueado', coalesce(v_used >= v_limit, false),
    'reinicia_em', v_reset,
    'bytes_enviados', v_used,
    'limite_bytes', v_limit
  );
end;
$function$;

revoke all on function public.status_uso_justo_upload_backend(uuid) from public, anon, authenticated;
grant execute on function public.status_uso_justo_upload_backend(uuid) to service_role;
