-- Camada de defesa para o bucket de vídeos.
-- A política geral de conta suspensa é restritiva; impedir acesso direto
-- via JWT ao bucket privado, mesmo que políticas permissivas sejam adicionadas.
alter policy storage_conta_nao_suspensa on storage.objects
using (
  bucket_id <> 'abertura-videos'
  and (
    bucket_id <> all (array['fotos'::text, 'marca'::text])
    or (select private.conta_nao_suspensa((select auth.uid())))
  )
)
with check (
  bucket_id <> 'abertura-videos'
  and (
    bucket_id <> all (array['fotos'::text, 'marca'::text])
    or (select private.conta_nao_suspensa((select auth.uid())))
  )
);