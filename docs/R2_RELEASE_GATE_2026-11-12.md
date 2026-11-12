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

## Escopo real do Storage identificado na auditoria
- `fotos`: 1.212 objetos, 1.664.649.601 bytes (fotografias/miniaturas).
- `abertura-videos`: 2 objetos, 11.969.667 bytes.
- `marca`: 12 objetos, 11.013.166 bytes (**bucket público atualmente**; requer estratégia de entrega pública seletiva/segura no R2 privado antes de retirar Supabase).
- `client-avatars`: 2 objetos, 49.430 bytes (acesso privado e exclusão obrigatórios).
- `feedback-anexos`: 0 objetos (fluxo de novos anexos deve ser adaptado mesmo sem conteúdo legado).
- Total: **1.228 objetos**. O escopo anterior cobria apenas fotos e vídeos; não atende o requisito de tirar *todas as mídias* do Supabase Storage.
- Dependências diretas ainda abertas: `app/perfil/page.tsx` (marca), `app/dashboard/clientes/page.tsx` (avatars e mídias da galeria), `app/dashboard/projetos/page.tsx` (thumbs e avatars), `app/api/feedback/route.ts` e `app/api/admin/feedback/route.ts` (anexos). Não habilitar o cutover até que uploads, leitura/autorização e limpeza desses fluxos sejam atendidos.

## Bloqueio de teste isolado (custo)
- A ferramenta Supabase não permite criar uma branch de teste sem confirmação explícita de custo. Valor informado pela conta: **US$ 0,01344 por hora**. Não houve autorização dessa despesa, portanto a branch de teste não foi criada e as migrações não foram aplicadas ao banco de produção.
## Atualização de validação — 12/11/2026
- Os testes `storage-cleanup` permanecem verdes; o job de sintaxe das sete migrações SQL R2 via pglast 8.7 passou após corrigir o delimitador `$` da função de confirmação de fotos. **Parser SQL não é execução de migrações.**
- Nova compilação de prévia com a trava de produção (`FOTURA_R2_FINAL_CUTOVER`) validada no processo de build. Ela continua desativada por padrão.
- Um replay completo em Supabase local falhou **antes** das migrações R2: a primeira migração histórica do repositório depende do schema `private`, ausente no baseline versionado. Para uma validação de integração fiel precisamos recuperar o baseline ou criar uma branch Supabase a partir da produção.
- A última execução E2E concluída após alterações nos seletores/testes registrou 152 aprovações e 18 falhas. Não há aprovação da suíte completa.
- A branch de teste do Supabase requer aceitação explícita do custo de US$ 0,01344 por hora, conforme retornado pela ferramenta; nenhum custo extra de branch foi autorizado ou ativado.
- O plano Supabase atual é Free. A plataforma inclui 5 GB de egress não cacheado por ciclo; a cópia integral (~1,69 GB de mídias) precisa respeitar a franquia restante e não deve ser disparada sem medição atual. Consulte a cota em Supabase antes de copiar.
## Validação sem branch paga — 12/11/2026

- O usuário **não autorizou** o custo de US$ 0,01344/h da branch Supabase. Respeitado: **nenhuma branch hospedada foi criada**.
- Em vez disso, foi adicionado um teste real de execução SQL em um serviço PostgreSQL 17 temporário do GitHub Actions, com estrutura mínima fictícia (sem conexão ao banco de produção).
- No workflow de limpeza, os três jobs agora passaram: **limpeza/regressão de segurança**, **parser PostgreSQL das migrações** e **integração SQL local**. O último aplica os scripts R2 e verifica por transações reservas/registro de fotos e miniaturas, vídeo de abertura, anexo de feedback, quota e claim/ack de limpeza órfã.
- Migrações preparadas para todos os buckets: `fotos`, `abertura-videos`, `marca`, `client-avatars`, `feedback-anexos`. Mídias auxiliares têm namespace físico próprio dentro de `fotura-media`.
- O upload de anexos de feedback no modo R2 já está preparado em código com verificação HEAD e uma RPC que registra feedback e imagem na mesma transação; visualização administrativa usa o adaptador privado. Continua **desligado** em produção.
- **Limite dos testes:** PostgreSQL local com tabelas de ensaio não replica integralmente RLS, configuração Supabase Auth/Storage, triggers preexistentes ou rede Cloudflare. E2E autenticado, avatares, logomarcas públicas e recuperação dos objetos reais seguem pendentes.
- Nenhuma credencial, dado de cliente, upload ou tabela de produção foi alterado nesta etapa.

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
