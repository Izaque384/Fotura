-- Corrige a validação do sufixo MP4 em PostgreSQL (sem depender de escape de barras).
create or replace function public.registrar_video_abertura_upload_backend(
  p_user_id uuid, p_projeto_id uuid, p_path text, p_bytes bigint
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_bytes is null or p_bytes <= 0 or p_bytes > 26214400
    or p_path !~ ('^' || p_user_id::text || '/' || p_projeto_id::text ||
                  '/[0-9a-f-]{36}[.]mp4$') then
    return false;
  end if;
  if not exists (
    select 1 from public.galeria_projetos
    where id = p_projeto_id and user_id = p_user_id
  ) then return false; end if;

  insert into private.abertura_video_uploads(path,user_id,projeto_id,bytes)
  values(p_path,p_user_id,p_projeto_id,p_bytes)
  on conflict (path) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    insert into private.upload_fair_use_mensal
      (user_id,mes,bytes_enviados,arquivos_enviados,atualizado_em)
    values(p_user_id,date_trunc('month',now() at time zone 'UTC')::date,p_bytes,1,now())
    on conflict (user_id,mes) do update set
      bytes_enviados = private.upload_fair_use_mensal.bytes_enviados + excluded.bytes_enviados,
      arquivos_enviados = private.upload_fair_use_mensal.arquivos_enviados + 1,
      atualizado_em = now();
  end if;
  return true;
end;
$$;
revoke all on function public.registrar_video_abertura_upload_backend(uuid,uuid,text,bigint) from public, anon, authenticated;
grant execute on function public.registrar_video_abertura_upload_backend(uuid,uuid,text,bigint) to service_role;
