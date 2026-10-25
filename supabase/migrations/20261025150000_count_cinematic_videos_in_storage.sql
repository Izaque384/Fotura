-- Inclui os vídeos cinematográficos privados no espaço ocupado de cada plano.
-- A função mantém a assinatura e as permissões existentes.
create or replace function public.billing_usage_backend(p_user_id uuid)
returns table(galerias_ativas bigint, clientes bigint, armazenamento_bytes bigint)
language sql
security definer
set search_path = 'public', 'storage'
as $$
  select
    (select count(*) from public.galerias g
      where g.user_id = p_user_id and coalesce(g.storage_limpo, false) = false),
    (select count(*) from public.clientes c where c.user_id = p_user_id),
    (select coalesce(sum(
      case when coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
        then (o.metadata->>'size')::bigint else 0 end
    ), 0)
      from storage.objects o
      where o.bucket_id in ('fotos', 'abertura-videos')
        and (storage.foldername(o.name))[1] = p_user_id::text
        and coalesce(o.is_delete_marker, false) = false);
$$;
