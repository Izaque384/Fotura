-- Retire the Google Contacts OAuth integration, keeping account purge working.
-- All tokens stored for the retired integration are deleted with this table.
-- Google-side OAuth grants must be revoked by their Google account owners.
CREATE OR REPLACE FUNCTION public.executar_purge_dados_backend(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_ids text[];
  v_count bigint;
  v_result jsonb := '{}'::jsonb;
  v_status text;
  v_elegivel timestamptz;
begin
  if exists (select 1 from public.admin_usuarios where user_id = p_user_id) then
    raise exception 'Conta administrativa não pode ser purgada.';
  end if;

  select status, elegivel_em into v_status, v_elegivel
  from public.admin_purges where user_id = p_user_id;
  if v_status is distinct from 'agendado' then
    raise exception 'Purge não está agendado.';
  end if;
  if v_elegivel is null or now() < v_elegivel then
    raise exception 'Purge ainda não está elegível.';
  end if;
  if not exists (select 1 from public.admin_encerramentos where user_id = p_user_id and status = 'confirmado') then
    raise exception 'Encerramento não confirmado.';
  end if;

  select coalesce(array_agg(id::text), array[]::text[]) into v_ids
  from public.galerias where user_id = p_user_id;

  delete from public.selecoes where galeria = any(v_ids); get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('selecoes', v_count);
  delete from public.senhas where galeria = any(v_ids); get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('senhas', v_count);
  delete from public.admin_takedown_galerias_estado where galeria_id::text = any(v_ids); get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('takedown_galerias_estado', v_count);
  delete from public.galerias where user_id = p_user_id; get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('galerias', v_count);
  delete from public.clientes where user_id = p_user_id; get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('clientes', v_count);
  delete from public.push_subscriptions where user_id = p_user_id; get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('push_subscriptions', v_count);
  delete from public.atividade_auditoria where user_id = p_user_id; get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('atividade_auditoria', v_count);
  delete from public.assinaturas where user_id = p_user_id; get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('assinaturas', v_count);
  delete from public.perfis where id = p_user_id; get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('perfis', v_count);
  delete from public.admin_suspensoes where user_id = p_user_id; get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('admin_suspensoes', v_count);
  delete from public.admin_takedowns_publicos where user_id = p_user_id; get diagnostics v_count = row_count; v_result := v_result || jsonb_build_object('admin_takedowns_publicos', v_count);

  return v_result;
end;
$function$;
DROP TABLE IF EXISTS public.google_integracoes;
