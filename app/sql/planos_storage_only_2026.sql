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

-- A policy de Storage é a autoridade final do upload. Mantenha estes limites
-- alinhados com app/lib/billing-plans.ts.
create schema if not exists private;

create or replace function private.billing_storage_insert_allowed(p_name text, p_metadata jsonb)
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
  v_new_bytes bigint := coalesce(
    nullif(p_metadata->>'size','')::bigint,
    nullif(p_metadata->>'contentLength','')::bigint,
    0
  );
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
  ) then
    return false;
  end if;

  select a.plano_codigo, a.status into v_plan, v_status
  from public.assinaturas a
  where a.user_id = v_uid;

  if v_plan = 'legacy' and v_status in ('active','trialing','past_due') then
    return true;
  end if;

  if v_plan is null
     or v_plan = 'sem_plano'
     or v_status not in ('active','trialing','past_due') then
    return false;
  end if;

  v_storage_limit_gb := case v_plan
    when 'gratis' then 1
    when 'essencial' then 10
    when 'profissional' then 50
    when 'studio' then 100
    else 0
  end;

  if v_storage_limit_gb <= 0 then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':billing:storage',0));

  select coalesce(sum(nullif(o.metadata->>'size','')::bigint),0)
    into v_current_bytes
  from storage.objects o
  where o.bucket_id='fotos'
    and (storage.foldername(o.name))[1]=v_uid::text;

  return v_current_bytes + greatest(v_new_bytes,0)
    <= v_storage_limit_gb::bigint * 1024 * 1024 * 1024;
end;
$function$;

revoke all on function private.billing_storage_insert_allowed(text,jsonb) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.billing_storage_insert_allowed(text,jsonb) to authenticated;

