# Fotura / Cloudflare R2 — bloqueio de publicação

Data da auditoria: 2026-11-12. Status: **NÃO APROVADO PARA CUTOVER/PRODUÇÃO**.

Objetivo confirmado: R2 como único storage de mídias após migração; Supabase somente database/Auth.

## Evidência coletada
- GitHub CI no commit `27156dd54519`: Storage cleanup regression **success**; E2E regression **failure** (148 passed, 21 failed, 1 flaky). O job E2E mostra `supabaseKey is required` no ambiente CI, além de falhas de interface/contrato. É necessário corrigir o ambiente CI e separar falhas pré-existentes de regressões.
- Vercel: compilação do preview em `e73c67710f9b` READY. Não valida os fluxos autenticados de galeria com R2 habilitado.
- Supabase produção: `public.fotura_media_objects` e `public.fotura_r2_upload_reservations` **não existem**; SQLs da migração ainda não aplicados.
- Vercel: segredo e configuração R2 presentes apenas para preview da branch. `FOTURA_R2_READ_ENABLED=false`, `FOTURA_R2_UPLOAD_ENABLED=false`.
- Rotas `app/api/fotos/r2/route.ts` e `app/api/projeto/video/route.ts` exigem `VERCEL_ENV=preview` para escrever no R2; estão explicitamente desativadas em produção.
- Cloudflare: bucket `fotura-media` privado, 0 objetos; somente CORS restrito GET/HEAD/PUT configurado.
- Supabase Storage: `fotos` = 1.212 objetos (~1.587,53 MB); `abertura-videos` = 2 objetos (~11,42 MB). Sem arquivos copiados para R2.
- Fotura produção: Vercel READY no commit `35092163fa8b`; não promover um preview incompleto.

## Condições obrigatórias para release
1. Preparar ambiente isolado de teste com as migrações SQL, validar RLS/grants, reservas, jobs, contagem de quota e transações com dados sintéticos.
2. Configurar segredos R2 também no ambiente correto da Edge Function de limpeza, testar tarefas expiradas de foto, thumb, vídeo e multipart e verificar HEAD 404 antes do ACK.
3. Substituir os bloqueios exclusivamente `preview` por mecanismo seguro de produção **somente após os testes**; exigir escolha única de provider (R2) em todos os novos uploads.
4. Validar em browser autenticado foto pequena, foto 50 MB multipart com retomada, thumb, seleção, download original, marca d'água, capa, entrega, PIN, senha, expiração, iPhone e vídeo de abertura.
5. Validar mudança/movimentação, exclusões de projeto/galeria/conta, falhas/retries, versões abandonadas e limpeza sem registros órfãos.
6. Reparar CI E2E e obter suite integral verde; repetir build de produção com as variáveis de produção, sem publicar.
7. Copiar arquivos antigos em lotes monitorados, com cuidado de egress Supabase; verificar cada objeto (tamanho e hash quando possível), preservar originais e registrar apenas cópias verificadas.
8. Publicar com rollback que preserve acesso aos objetos já exclusivos do R2; monitorar saúde, erros, quotas, logs e tráfego; só posteriormente excluir os arquivos legados após janela de retenção.

## Ação proibida até os gates verdes
Não fazer merge deste PR, não habilitar flags, não aplicar todas as migrações diretamente em produção nem apagar arquivos do Supabase; não afirmar que todos os testes passaram ou que a migração terminou.
