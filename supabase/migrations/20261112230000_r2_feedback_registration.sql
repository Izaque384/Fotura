-- Service-only atomic registration of a verified R2 feedback screenshot.
-- The API performs MIME, byte size and HEAD verification before calling.
-- Both feedback row and private registry entry commit or roll back together.
create or replace function public.registrar_feedback_r2_backend(
  p_user_id uuid,
  p_tipo text,
  p_categoria text,
  p_assunto text,
  p_mensagem text,
  p_nota smallint,
  p_pagina_origem text,
  p_navegador text,
  p_screenshot_path text,
  p_screenshot_nome text,
  p_screenshot_mime text,
  p_screenshot_bytes bigint,
  p_etag text
) returns table (feedback_id uuid, feedback_created_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_created timestamptz;
begin
  if p_user_id is null or p_screenshot_path is null or
    p_screenshot_path !~ ('^' || p_user_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]{1,100}$') or
    p_screenshot_mime not in ('image/png','image/jpeg','image/webp') or
    p_screenshot_bytes < 1 or p_screenshot_bytes > 5242880 or
    p_tipo not in ('problema','sugestao','feedback') or
    p_categoria not in ('galerias','clientes','selecoes','vendas','planos','perfil','conta','outro') or
    length(p_assunto) not between 3 and 120 or
    length(p_mensagem) not between 10 and 3000 or
    (p_nota is not null and (p_nota < 1 or p_nota > 5))
  then raise exception 'Invalid R2 feedback payload'; end if;

  -- Lock the exact pending reservation; an expired cleanup lease must never
  -- delete an attachment while this registration is in progress.
  if not exists (
    select 1 from public.fotura_r2_upload_reservations q
    where q.bucket='feedback-anexos' and q.object_key=p_screenshot_path
      and q.owner_id=p_user_id and q.thumbnail_key is null
      and q.state='pending' and q.expires_at > now()
    for update
  ) then raise exception 'R2 feedback reservation unavailable'; end if;

  insert into public.feedbacks (
    user_id,tipo,categoria,assunto,mensagem,nota,pagina_origem,navegador,
    screenshot_path,screenshot_nome,screenshot_mime,screenshot_bytes
  ) values (
    p_user_id,p_tipo,p_categoria,p_assunto,p_mensagem,p_nota,p_pagina_origem,
    p_navegador,p_screenshot_path,p_screenshot_nome,p_screenshot_mime,p_screenshot_bytes
  ) returning id,criado_em into v_id,v_created;

  insert into public.fotura_media_objects
    (bucket,object_key,owner_id,bytes,content_type,etag,verified_at)
  values (
    'feedback-anexos',p_screenshot_path,p_user_id,p_screenshot_bytes,
    p_screenshot_mime,p_etag,now()
  );

  delete from public.fotura_r2_upload_reservations q
  where q.bucket='feedback-anexos' and q.object_key=p_screenshot_path
    and q.owner_id=p_user_id;
  feedback_id:=v_id;
  feedback_created_at:=v_created;
  return next;
end;
$$;
revoke all on function public.registrar_feedback_r2_backend(
  uuid,text,text,text,text,smallint,text,text,text,text,text,bigint,text
) from public,anon,authenticated;
grant execute on function public.registrar_feedback_r2_backend(
  uuid,text,text,text,text,smallint,text,text,text,text,text,bigint,text
) to service_role;
