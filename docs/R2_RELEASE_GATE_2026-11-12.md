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

## Atualização sem transferência de mídia — 12/11/2026 (à noite)

- **Regra acordada:** nenhuma cópia das 1.228 mídias existentes antes de **23/11/2026**, e somente se o dashboard da Supabase confirmar a renovação da franquia. Ver `docs/R2_LEGACY_TRANSFER_POLICY.md`. O dia 22/11 foi apresentado como data provável, ainda não comprovada.
- A documentação oficial informa 5 GB de egress não cacheado e 5 GB cacheado por ciclo para o plano Free; exceder a franquia pode causar **restrições**, não cobranças automáticas por egress no Free.
- Telas de clientes e projetos migradas, na branch, para leitura autenticada de avatares e capas via adaptador de mídia; seleção de foto da galeria para avatar usa catálogo híbrido e download autorizado, sem Storage direto pelo navegador.
- Upload/remoção de avatares preparado com API autenticada que preserva a referência do cliente; R2 usa reserva privada, HEAD de verificação, registro transacional e DELETE/HEAD 404 para limpeza. SQL em `20261112240000_r2_avatar_registration.sql`.
- Integração de avatares adicionada ao PostgreSQL descartável CI; os três jobs da última execução de segurança foram verdes: cleanup, syntax e SQL integration.
- O fluxo E2E já executou **Next.js build + TypeScript check com sucesso** na branch; o restante da suíte não está integralmente aprovado.
- Uma nova prévia Vercel foi recusada por limite **api-deployments-free-per-day** (mais de 100 deployments em 24 horas). Não se alterou o plano nem houve cobrança.
- **Não mudou**: flags R2 desligadas, produção no commit anterior, registros SQL R2 não aplicados, nenhuma mídia real transferida. Logo público do estúdio continua como bloqueador da mudança integral.

## Logos dos estúdios — etapa de código e testes locais (12/11/2026)
- Upload novo: no modo R2, preparação autenticada com chave reservada, PUT direto do navegador ao bucket privado e confirmação por HEAD + RPC transacional. Preserva o limite atual de 5 MB sem atravessar a função Vercel, cujo corpo é limitado a 4,5 MB.
- Entrega pública: URL relativa estável `/api/marca/{owner}/{filename}`. A rota somente serve o logotipo cujo caminho corresponde ao valor atual de `perfis.logo_url` e cuja chave/tamanho/MIME constam do registro privado R2. O bucket permanece privado.
- Open Graph de galeria: busca o logotipo R2 por adaptador privado no servidor; imagens antigas continuam pelo URL público legado até a cópia verificada.
- Migração SQL adicionada: `20261112243000_r2_studio_logo_registration.sql`; casos de integração SQL e de segurança adicionados ao GitHub Actions.
- Mantém o upload Supabase legado **apenas enquanto o modo R2 estiver desativado**. A escolha do destino não recua silenciosamente do R2 para o Supabase.
- **Ainda não aprovado para produção:** faltam teste autenticado em navegador com R2 ligado e validação de acessibilidade/preview compartilhado; a Vercel limitou deploys adicionais por dia.
- Dependência residual: a folha `app/app/lavanda-moderna.css` contém uma imagem estática apontando para `storage/v1/object/public/marca/landing/fotura-wedding-sunset-generated.png`. Deve ser copiada/verificada e apontada para local definitivo antes da retirada total do Storage, observando o bloqueio de egress até 23/11.
- Avatares de clientes (até 8 MB) foram adaptados na branch para PUT direto e temporário ao R2, com autorização por cliente, reserva, HEAD de integridade e registro atômico. Antes do cutover, o envio legado continua sendo feito diretamente do navegador ao Supabase. **Falta validar o comportamento em navegador autenticado.**
- **Anexos de feedback (13/11):** código preparado para PUT direto ao R2 pelo navegador (até 5 MB), sem bytes na função Vercel. Nova rota autenticada reserva a chave; envio confirma HEAD de MIME/tamanho e registra feedback + mídia em uma única transação. Fluxo Supabase legado permanece somente com o modo R2 desligado. **Ainda falta validar em navegador autenticado e na suíte completa antes de qualquer cutover.**

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

## Continuação de segurança — 13/11/2026
- Todas as novas URLs R2 de PUT simples foram preparadas com assinatura de condição `If-None-Match: *`, usada também nos uploads pelo navegador. A conclusão de fotos multipartes tem a mesma condição assinada no servidor. Essa proteção impede que uma URL de escrita temporária substitua um objeto já registrado.
- Bucket `fotura-media`: CORS atualizado exclusivamente para aceitar `If-None-Match`, preservando origens, métodos e privacidade.
- Introduzido teste E2E de barreiras de autenticação e origem externa das APIs de mídia, separado da suíte completa. A última suíte completa conhecida continua com **152 aprovados e 18 falhas**; não é gate verde. Não remover o bloqueio de publicação.
- **Pendente:** validar PUT/412 reais, uploads autenticados, reconciliação de respostas ambíguas, limites de egress, acessos públicos seletivos e limpeza end-to-end.

## Flag de cutover consistente — 13/11/2026
- Revisada a configuração de todas as classes de mídia: mesmo com `FOTURA_R2_FINAL_CUTOVER=true`, o upload auxiliar não será ativado se `FOTURA_R2_UPLOAD_ENABLED` estiver ausente ou falso. Isso evita iniciar apenas logotipos, avatares e anexos enquanto fotos e vídeos falhariam por configuração incompleta.
- Não alterou as flags atuais (todas continuam desativadas), nem os arquivos existentes. A ativação final continua bloqueada até validação completa.

## Limite real de corpos de metadados R2 — 13/11/2026
- No modo R2, o formulário de feedback lê no máximo **32 KiB de bytes**. A preparação de anexo lê no máximo **2 KiB**, independentemente de Content-Length, rejeitando o excesso e cancelando o stream.
- Testes Node sem rede validam requisições chunked, ausência de Content-Length, UTF-8 multibyte, multipart pequeno e bloqueio de imagem indevida pelo endpoint de metadados.
- Caminho Supabase legado permanece igual até o corte autorizado. Não há alteração de mídias, schema ou flags.
- Ainda são necessários testes autenticados e reais de S3/R2 antes de habilitar uploads.

## Proteção de metadados nas demais APIs — 13/11/2026
- Leitura limitada por bytes também em fotos (`8 KiB`), vídeo de abertura (`4 KiB`), marca (`2 KiB`), avatares (`4 KiB POST`, `2.500 bytes DELETE`).
- Resposta HTTP 413 para corpo excessivo independentemente de `Content-Length`; alterações restritas ao processamento de JSON e sem mexer em banco, objetos ou flags.
- Novo teste de contrato verifica que as seis rotas R2 não fazem leitura integral sem limite. Integração autenticada com Cloudflare continua pendente.

## Cancelamento sem corrida entre R2 e Postgres — 13/11/2026
- Cancelar envio de foto **não faz mais DELETE imediato** no R2: antes havia janela entre consulta do registro e exclusão física, durante a qual a outra requisição poderia confirmar a foto. Removida essa janela de perda de mídia.
- Agora o cancelamento altera atomicamente a reserva de `pending` para `cleaning`, desautorizando confirmação e novas partes assinadas. Com o mesmo row-lock usado na RPC de confirmação, uma confirmação concorrente vence ou perde o bloqueio antes de qualquer limpeza.
- A limpeza órfã com lease só retoma depois de dez minutos, dando tempo para expirar as URLs de PUT de cinco minutos e uploads já iniciados, e verifica novamente ausência no registro antes do DELETE e do ACK.
- Contagem de pendentes contempla apenas reservas `pending` ainda válidas. Não gera exclusão de objetos antigos, mudança em produção nem mídia de cliente.
- Necessário teste com falhas reais de rede, abortos multipart e confirmações concorrentes antes do cutover.

## Reconciliação de PUT com resposta perdida — 13/11/2026
- Implementado `verificar` autenticado na API de fotos R2: somente dono + ticket assinado + reserva pendente válida ou mídia já registrada podem consultar `HEAD` de original e thumb. Confere MIME e quantidade exata de bytes.
- PUT create-only que recebeu erro de rede, timeout ou HTTP 412 só é considerado concluído após `HEAD` positivo; 412 isolado nunca indica sucesso nem autoriza substituição.
- Confirmação de banco que perdeu a resposta é tentada novamente de forma idempotente após reconciliação. Se original e thumb foram conferidos, falhas de confirmação não cancelam a reserva automaticamente; prevenção de perda de upload em estado ambíguo.
- Ainda são necessários teste real com R2 e perda simulada de resposta, e comparação de hash para provas de integridade mais fortes.

## Cancelamento de vídeos e limite de versões — 13/11/2026
- Cancelar upload MP4 ainda pendente não executa `DELETE` no objeto: marca a reserva como `cleaning` com 10 minutos de proteção antes da limpeza verificada, permitindo que URLs de PUT de 5 minutos expirem.
- O limite de cinco versões deixa de contar reservas que não estão pendentes e válidas. Para vídeos já registrados, o DELETE revalida o vídeo publicado no banco imediatamente antes de removê-lo.
- Pendente para publicação: garantir atomicidade de exclusão de vídeo registrado com mudanças simultâneas de configuração (um segundo GET não equivale a uma transação). A limpeza de vídeos não confirmados fica isolada e com lease.

## Bloqueio corrigido: fotos selecionadas na preparação da entrega — 13/11/2026
- A tela `/dashboard/entrega/[id]` ainda chamava o Supabase Storage diretamente para assinar fotos da seleção, e falharia para originais que fossem criados exclusivamente no R2.
- Agora `GET /api/galeria/entrega`, já autenticado pelo dono, usa o catálogo da galeria para validar nomes e o adaptador `signPrivateMediaUrls` para assinar cada objeto conforme registro privado R2 ou legado Supabase. URLs só são devolvidas após `galerias.user_id = auth.user.id`.
- A tela consome `selecionadas` já assinadas pelo servidor. Teste de regressão impede a reintrodução de `createSignedUrls` direto na tela.
- Resta validar manualmente seleção e download reais com arquivos R2, incluindo expirados, falhas parciais e iPhone.

## Seleção do fotógrafo usa URL assinada híbrida — 13/11/2026
- `ModalSelecao` não faz mais `supabase.storage.createSignedUrls()` diretamente. Usa GET `/api/fotos/selecao-proprietario` com sessão autenticada.
- O servidor verifica `galerias.user_id`, seleciona somente arquivos presentes em `selecoes.fotos` ou `comentarios` e no catálogo autorizado da pasta, e assina originais e miniaturas por `signPrivateMediaUrls`.
- Incluídos contratos estáticos e teste HTTP sem autenticação. A listagem usa lotes limitados de 200 chaves e no máximo 500 fotos; leituras legadas continuam disponíveis.
