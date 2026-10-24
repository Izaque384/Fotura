-- Vídeo opcional de fundo da abertura cinematográfica. Bucket privado,
-- limitado a MP4 de 25 MiB; nenhum acesso público ou política de escrita direta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('abertura-videos', 'abertura-videos', false, 26214400, array['video/mp4']::text[])
on conflict (id) do nothing;

create table if not exists private.abertura_video_uploads (
  path text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  projeto_id uuid not null references public.galeria_projetos(id) on delete cascade,
  bytes bigint not null check (bytes > 0 and bytes <= 26214400),
  criado_em timestamptz not null default now()
);
create index if not exists abertura_video_uploads_projeto_idx
  on private.abertura_video_uploads(projeto_id);

-- Cada MP4 bem-sucedido é contabilizado uma única vez na franquia mensal.
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
                  '/[0-9a-f-]{36}\\.mp4$') then
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
