-- Fotura Marco 1: PRODUCTION READ-ONLY SCHEMA PREFLIGHT.
-- Run against the live Supabase project before any DDL or R2 rollout.
-- Empty result = no missing baseline dependency; NOT proof of safe rollout.
-- No customer rows are read, no functions called, no storage objects touched.
with required_columns(schema_name,table_name,column_name) as (values
('auth','users','id'),
('storage','objects','bucket_id'),('storage','objects','name'),('storage','objects','is_delete_marker'),
('public','galerias','id'),('public','galerias','user_id'),('public','galerias','storage_limpo'),('public','galerias','etapa'),
('public','galeria_foto_metadata','galeria_id'),('public','galeria_foto_metadata','user_id'),('public','galeria_foto_metadata','variante'),('public','galeria_foto_metadata','nome'),('public','galeria_foto_metadata','largura'),('public','galeria_foto_metadata','altura'),('public','galeria_foto_metadata','bytes'),('public','galeria_foto_metadata','mime_type'),('public','galeria_foto_metadata','thumb_bytes'),('public','galeria_foto_metadata','atualizado_em'),
('private','upload_fair_use_mensal','user_id'),('private','upload_fair_use_mensal','mes'),('private','upload_fair_use_mensal','bytes_enviados'),('private','upload_fair_use_mensal','arquivos_enviados'),('private','upload_fair_use_mensal','atualizado_em'),
('private','abertura_video_uploads','path'),('private','abertura_video_uploads','user_id'),('private','abertura_video_uploads','projeto_id'),('private','abertura_video_uploads','bytes'),
('public','storage_cleanup_jobs','id'),('public','storage_cleanup_jobs','galeria_id'),('public','storage_cleanup_jobs','user_id'),('public','storage_cleanup_jobs','status'),('public','storage_cleanup_jobs','lease_token'),('public','storage_cleanup_jobs','lease_until'),('public','storage_cleanup_jobs','prefix'),('public','storage_cleanup_jobs','next_attempt_at'),('public','storage_cleanup_jobs','completed_at'),('public','storage_cleanup_jobs','verified_at'),('public','storage_cleanup_jobs','last_error'),('public','storage_cleanup_jobs','failures'),
('public','galeria_projetos','id'),('public','galeria_projetos','user_id'),('public','galeria_projetos','abertura_config'),
('public','clientes','id'),('public','clientes','user_id'),('public','clientes','avatar_path'),
('public','feedbacks','id'),('public','feedbacks','user_id'),('public','feedbacks','tipo'),('public','feedbacks','categoria'),('public','feedbacks','assunto'),('public','feedbacks','mensagem'),('public','feedbacks','nota'),('public','feedbacks','pagina_origem'),('public','feedbacks','navegador'),('public','feedbacks','screenshot_path'),('public','feedbacks','screenshot_nome'),('public','feedbacks','screenshot_mime'),('public','feedbacks','screenshot_bytes'),('public','feedbacks','criado_em'),
('public','perfis','id'),('public','perfis','logo_url'),('public','perfis','atualizado_em')
), missing_columns as (
select 'column'::text as kind, r.schema_name||'.'||r.table_name||'.'||r.column_name as item
from required_columns r where not exists (
  select 1 from information_schema.columns c
  where c.table_schema=r.schema_name and c.table_name=r.table_name
    and c.column_name=r.column_name
)
), required_functions(name) as (values
('public.registrar_video_abertura_upload_backend(uuid,uuid,text,bigint)'),
('public.storage_cleanup_finish(uuid,uuid,text)'),
('private.dispatch_storage_cleanup()'),
('net.http_post(text,jsonb,jsonb,jsonb,integer)'),
('extensions.hmac(text,text,text)')
), missing_functions as (
select 'function'::text as kind, name as item from required_functions
where to_regprocedure(name) is null
)
select kind,item from missing_columns
union all select kind,item from missing_functions
order by kind,item;
