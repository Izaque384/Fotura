-- Add R2-only media to the photographer's per-gallery storage summary.
-- Legacy Supabase storage and copied R2 objects are never double-counted.
-- Requires the R2 media registry migration. This is a read-only RPC.

create or replace function public.r2_extra_storage_gallery_summary_backend(p_user_id uuid)
returns table (
  galeria_id uuid,
  bytes_extra bigint,
  arquivos_extra bigint,
  bytes_entrega_extra bigint,
  arquivos_entrega_extra bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id,
    coalesce(sum(r.bytes),0)::bigint,
    count(r.object_key)::bigint,
    coalesce(sum(r.bytes) filter (
      where split_part(r.object_key,'/',3) = 'entrega'
    ),0)::bigint,
    count(r.object_key) filter (
      where split_part(r.object_key,'/',3) = 'entrega'
    )::bigint
  from public.galerias g
  left join public.fotura_media_objects r
    on r.bucket='fotos'
   and r.owner_id=p_user_id
   and r.object_key like p_user_id::text || '/' || g.id::text || '/%'
   and not exists (
     select 1 from storage.objects s
     where s.bucket_id=r.bucket and s.name=r.object_key
       and coalesce(s.is_delete_marker,false)=false
   )
  where g.user_id=p_user_id
  group by g.id;
$$;

revoke all on function public.r2_extra_storage_gallery_summary_backend(uuid)
  from public,anon,authenticated;
grant execute on function public.r2_extra_storage_gallery_summary_backend(uuid)
  to service_role;
