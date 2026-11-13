# Fotura — migração controlada de mídia para Cloudflare R2

Status: **etapa 2 em revisão: piloto de escrita na branch de prévia, desativado; sem migração, sem cutover**.

## Verificações realizadas em 2026-11-12
- Bucket Cloudflare **fotura-media** criado em Standard, sem domínio público; CORS GET/HEAD/PUT apenas em `foturax.com.br` e na alias fixa desta branch de prévia.
- Conta Cloudflare conectada e token S3 **com acesso exclusivo ao bucket**. Variáveis armazenadas na Vercel apenas para a branch de preview, sem publicação em production.
- Smoke Cloudflare REST: PUT, GET, conferência byte a byte e exclusão de um arquivo sintético de 23 bytes, aprovado.
- Smoke real do Next.js na Vercel: URLs S3 SigV4 para PUT, GET, HEAD e DELETE, todas verificadas com sucesso. A rota pública temporária de teste foi **retirada** e a flag temporária desativada.
- Listagem híbrida de fotos preparada nos endpoints de galeria pública, seleção de imagens e entrega final; a flag de leitura do R2 continua **false**.
- Inventário Supabase: **1212 objetos em fotos (~1587,53 MB)** e **2 objetos em abertura-videos (~11,42 MB)**; não confundir tamanho de objetos atual com métricas de GB-hora do faturamento.
- Zero fotografias de clientes transferidas ou excluídas. SQL do catálogo privado foi **apenas versionado**, não aplicado ao banco de produção.

## Objetivo

### Decisão de arquitetura confirmada
Cloudflare R2 será o armazenamento **único e definitivo de todas as mídias** do Fotura: originais, miniaturas, capas, arquivos de entrega e vídeos. Supabase permanecerá para banco de dados, autenticação, permissões e metadados. O modo híbrido de leitura será **temporário**, apenas durante a migração dos arquivos existentes. Não lançar fluxo que envie novas fotos pequenas ao R2 e grandes ao Supabase; em modo R2, uma falha deve ser reportada sem salvar o arquivo em outro storage. A ativação de produção depende da implementação e da validação do multipart/resumível, limpeza, exclusão e rollback.
Manter PostgreSQL/Auth do Supabase e passar arquivos dos buckets **fotos** e **abertura-videos** ao bucket privado Cloudflare R2 **fotura-media**, sem alterar nomes de arquivos, links de projetos ou qualidade dos originais.

## Controles de segurança
- Bucket privado: **r2.dev desligado, sem domínio público**.
- Credencial S3 R2 com **Object Read & Write somente neste bucket**. Guardar em segredos Vercel, nunca em variáveis NEXT_PUBLIC_*, no Git ou em logs.
- A autorização de projeto/galeria, PIN, senha e expiração ocorre **antes** de gerar URLs temporárias. Uma URL assinada é um bearer token temporário.
- O registro **fotura_media_objects** só deve receber objetos depois da cópia e conferência de tamanho/checksum. O registro é acessível **somente pelo servidor**, e não concede acesso público.
- **Não excluir o Supabase Storage original** até a conclusão dos testes, confirmação de cópia e da política de retenção.
- Evitar migração em massa enquanto o plano Supabase estiver perto do Egress permitido.

## Flags e variáveis
- **FOTURA_R2_READ_ENABLED**: **desligada por padrão**. Só habilitar depois de validar credenciais, registrar cópias verificadas e cobrir todos os caminhos de leitura/mutação.
- **FOTURA_R2_UPLOAD_ENABLED**: **desligada por padrão**. Piloto exige também R2_READ_ENABLED=true e VERCEL_ENV=preview; não é possível ativar esse envio na produção com o código atual.
- **R2_ACCOUNT_ID**: ID da conta Cloudflare (servidor).
- **R2_MEDIA_BUCKET**: fotura-media.
- **R2_ACCESS_KEY_ID**, **R2_SECRET_ACCESS_KEY**: credenciais S3 específicas do bucket; exclusivamente servidor.
- **A divisão de uploads novos entre os dois storages é proibida.** Enquanto o piloto permanecer desativado, todos os uploads continuam no Supabase. Quando o R2 estiver pronto e for ativado, **todos os uploads novos** (originais e miniaturas, independentemente do tamanho) deverão ir para o R2. A leitura do Supabase antigo será temporária exclusivamente para migrar arquivos legados com segurança.

## Escopo já preparado
- URLs de leitura para downloads autorizados e galeria pública (miniaturas e originais), abertura de projetos (fotos/vídeos) e miniaturas do painel.
- Roteamento por objeto: R2 **somente** quando existir entrada verificada no registro privado e a flag estiver ativada; caso contrário, Supabase.
- Migração SQL adiciona apenas tabela privada, sem alterar tabelas/fotos existentes.

## Etapa 6 — compatibilidade de clientes e bloqueio de egress (em revisão)

- A leitura de avatares privados e de miniaturas de capa nos painéis de Clientes/Projetos passou a usar APIs autenticadas que conferem a titularidade do cliente/projeto e assinam o objeto pelo adaptador R2/Supabase.
- O seletor de fotos da galeria para criar avatares passou a obter miniaturas pelo catálogo híbrido e por download autorizado do servidor, sem acessar diretamente o Supabase Storage no navegador.
- Upload e remoção de avatares têm agora rota autenticada preparada para o modo R2: chave reservada antes do upload, HEAD de integridade, vinculação transacional no banco, exclusão apenas após desvincular, DELETE e HEAD 404 verificados. O modo R2 permanece desativado.
- Incluída migração `20261112240000_r2_avatar_registration.sql` e cenários sintéticos de confirmação de avatares no PostgreSQL descartável do CI.
- Política de custo em `docs/R2_LEGACY_TRANSFER_POLICY.md`: **não transferir mídias reais antes de 23/11/2026**, e mesmo depois somente após confirmar o reset efetivo do egress do Supabase e o orçamento de tráfego disponível. Não há cópia agendada automaticamente.
- **Pendente:** fluxo de logotipo público do estúdio, atualização de links persistentes, testes autenticados de todos os navegadores, implementação de cópia/checagem de todos os buckets antigos e ativação controlada de produção.

## Etapa 5 — vídeos e envios não confirmados (em revisão)
- O envio de MP4 de abertura agora tem caminho R2 na prévia: PUT temporário, conferência de bytes e tipo, registro atômico no banco e visualização por URL temporária. Em modo R2 não há fallback silencioso para o Supabase.
- Fotos e vídeos recebem uma reserva privada antes de o sistema fornecer a URL de upload. A confirmação só é aceita quando a reserva ainda é válida, pertence ao usuário e não entrou em limpeza. A confirmação também retira a reserva atomicamente.
- Uma fila segura para uploads abandonados foi preparada: depois de expirar o ticket de 24 horas e mais 12 horas de margem, o worker pode reivindicar a reserva com lease, cancelar multipartes, apagar somente as chaves registradas e confirmar HEAD 404 antes de remover os metadados pendentes.
- A fila de exclusão de galerias também verifica reservas pendentes, evitando a marcação incorreta de limpeza concluída. Exclusões de projetos e contas com mídias ou reservas R2 continuam bloqueadas enquanto não houver limpeza segura.
- Novos limites protegem contra criação excessiva de uploads sem confirmação: até 25 reservas de fotos simultâneas por usuário e 5 vídeos (contabilizando vídeos confirmados e reservas) por projeto.
- Migrações novas somente versionadas no GitHub: 20261112160000_r2_upload_reservations.sql, 20261112210000_r2_intro_video_registration.sql e 20261112220000_r2_abandoned_upload_cleanup.sql.
- O teste automatizado tests/r2-migration-safety.test.ts agora verifica isolamentos, reservas e ações destrutivas, via GitHub Actions.
- **Não habilitar as flags, não aplicar os SQLs e não colocar a Edge Function em produção** até uma validação controlada da tabela de reservas, workflow de limpeza real e casos extremos (falha de rede, retenção, quota, envio com logout, vídeo no Safari).

## Etapa 4 — limpeza durável preparada (ainda não ativada)
- Mantida a fila existente de limpeza de galerias; adicionadas RPCs independentes para localizar objetos R2 pelo prefixo exato, validar o lease e reconhecer a remoção após DELETE e HEAD 404 no R2.
- A Edge Function de limpeza foi adaptada para excluir objetos R2 com credenciais S3 restritas ao bucket e só então reconhecer a retirada dos registros de fotura_media_objects. As credenciais para a função devem ser configuradas como segredos protegidos apenas no rollout.
- A RPC de conclusão impede marcar o trabalho completo enquanto existir objeto legado no Supabase ou objeto registrado no R2. O dispatcher reabre trabalhos concluídos se uma mídia tardia for registrada sob o mesmo prefixo.
- Testes unitários de fila mista, falha na verificação remota, nova tentativa, restrição de prefixo e conclusão passaram no GitHub Actions.
- O painel de armazenamento passa a ter suporte ao uso exclusivo do R2, sem dupla contagem de mídias previamente copiadas.
- Novas migrações somente no GitHub: 20261112190000_r2_durable_cleanup.sql e 20261112200000_r2_storage_gallery_summary.sql; NÃO aplicadas ao banco.
- Bloqueadores: limpeza de objetos R2 enviados mas nunca registrados (uploads abandonados), remoção de vídeos R2 por projeto, teste da Edge Function com segredos, testes autenticados de galeria e cutover de todos os uploads (inclusive vídeo).
- Bloqueios preventivos de exclusão de galerias, projetos e contas com mídia R2 permanecem até termos limpeza completa validada; nenhum arquivo de cliente foi removido.

## Etapa 3 — envio multipartes (em validação)
- Foi adicionada a camada S3 multipartes no servidor: início, URL assinada por parte de 8 MiB, consulta de partes, conferência de tamanho antes de finalizar e cancelamento.
- **Teste sintético aprovado em prévia:** upload em duas partes, listagem e conferência dos bytes, conclusão, HEAD, leitura parcial (Range), exclusão do arquivo e abort de multipart incompleto. A rota temporária de teste foi removida e a flag de teste foi desativada.
- O upload multipartes está **preparado no fluxo autenticado de fotos**, usando ticket HMAC vinculado ao dono/galeria/arquivo (24 horas), URLs temporárias por parte, consulta ao R2 das partes persistidas e retomada via sessionStorage ao recarregar a aba. **Ainda não houve teste de navegador com usuário real, aplicação do SQL ou ativação em produção.**
- Modo definitivo: **todo arquivo novo vai ao R2**. O Supabase Storage permanece apenas como fonte dos arquivos legados durante sua migração controlada.

## Etapa 2 preparada no código (sem ativação)
- Endpoint autenticado `POST /api/fotos/r2` gera URL temporária para cada foto e sua miniatura JPEG, validando titularidade da galeria, etapa, tipo, tamanho, franquia de uso justo, armazenamento e limite de fotos. A confirmação usa HEAD assinado para verificar tipo e bytes antes de registrar; uma segunda checagem de cotas acontece antes da confirmação.
- O endpoint está bloqueado **fora de prévia** e também permanece desativado por flag. A escolha do provedor é única por sessão de envio, e falhas ao conferir a configuração não podem provocar fallback silencioso ao Supabase. Não enviar arquivos reais antes das validações abaixo.
- `app/lib/r2-photo-upload-client.ts` prepara PUT com progresso e repetição curta até **50 MB**, limite atual do Fotura. **Quando o modo R2 estiver habilitado, todas as fotos novas devem ir exclusivamente ao R2, independentemente do tamanho**. Ainda falta implementar multipart com retomada confiável antes da ativação definitiva.
- As páginas de envio principal e de entrega final já contêm o fallback condicional ao fluxo atual.
- O catálogo híbrido mescla fotos de ambos os provedores, e o workspace reconhece fotos R2 nas capas e abertura. O gerenciador **bloqueia movimentar arquivos R2** antes de haver cópia verificada e rollback seguro.
- Duas migrações SQL **versionadas, não aplicadas**: registro privado de objetos R2 e rotina transacional de confirmação com metadados e uso justo, além da contagem de bytes exclusivos do R2 nos limites da conta.
- CORS e CSP atualizados para o host S3 privado do R2. O token fica restrito ao bucket e suas variáveis apenas na prévia.
- Verificação da prévia com o piloto desligado: GET /api/fotos/r2 retornou `enabled:false`, conforme esperado.
- **Não executar a migração nem habilitar flags** antes de: (1) revisar/aplicar SQL em janela controlada e testar RLS/RPC, (2) testar foto sintética de ponta a ponta no navegador autenticado, (3) implementar exclusão e limpeza R2 e (4) corrigir caminhos ainda dependentes de `storage.objects`.
- Travas preventivas de exclusão: em modo R2, galerias, projetos e purges com arquivos R2 registrados **não são apagados** até existir limpeza verificada. A FK do registro de mídia para auth.users usa **ON DELETE RESTRICT** para evitar perder a rastreabilidade antes da limpeza.
- O bucket `fotura-media` possui regra padrão Cloudflare que aborta uploads multipartes pendentes após **7 dias**; a retomada da aplicação permite ticket de **24 horas**, reduzindo o risco de operações abandonadas.

## Escopo ainda obrigatório antes de ativar a migração
1. **Concluído para a prévia:** credencial restrita ao bucket e teste sintético de PUT/GET/HEAD/DELETE; **falta testar o fluxo de galeria autenticado**.
2. **Preparado em piloto (até 50 MB, desativado):** foto original, miniatura, confirmação e limites; falta teste real em navegador e multipart/resumível para a confiabilidade definitiva.
3. **Parcial:** catálogo híbrido e quota de armazenamento propostos; faltam painel de storage, rotinas SQL de limpeza, listagens diretas do navegador e testes de volume.
4. **Parcial:** capas, abertura, entrega e prévias reconhecem R2; movimentação R2 está bloqueada preventivamente, e vídeos ainda gravam no Supabase.
5. **Bloqueador da ativação:** remover mídias R2 na exclusão de galeria/projeto/conta, tratar uploads abandonados e garantir rollback, contador de quotas e reconciliação consistentes.
6. Testes reais em prévia, com uma galeria de teste pequena, e testes de senha, PIN, expiração, downloads em qualidade original e iPhone.
7. Copiar em lotes pequenos após a renovação da franquia, verificar cada objeto (tamanho/checksum), registrar sucesso e **preservar original**.
8. Só então ativar as leituras no R2 gradualmente, monitorar erros/egress/operadores e decidir por novas gravações.
9. Remover cópias antigas apenas após janela de retenção e confirmação explícita.

## Reversão
**Antes de qualquer objeto exclusivo do R2**, desligar FOTURA_R2_READ_ENABLED recupera as leituras do Supabase. **Depois que houver fotos exclusivas do R2**, desligar essa flag as esconderia: primeiro parar novos uploads e copiar os objetos R2 exclusivos de volta ao Supabase com verificação, ou manter R2_READ ligado até o rollback terminar. Nunca contar com a reversão da aplicação para recuperar objetos já excluídos.

## Notas sobre custos
R2 não cobra tarifa por egress, mas cobra armazenamento e operações além da franquia; transferir arquivos existentes **para fora do Supabase pode consumir o Egress do Supabase**.

## Anexos de feedback — 13/11/2026 (somente código de prévia)
- Imagens PNG/JPG/WebP até 5 MB são enviadas diretamente do navegador para `feedback-anexos/` no bucket R2 privado, sob reserva autenticada. A função Vercel recebe apenas metadados, evitando o limite de 4,5 MB.
- O POST do feedback consulta reserva pendente, confere HEAD (MIME e bytes) e chama a RPC transacional já versionada. Em modo R2 não há fallback de anexos para Supabase.
- O fluxo Supabase anterior é preservado enquanto as flags R2 estiverem desligadas. Limite de reservas pendentes e rate limit na preparação evitam abuso.
- Necessário CI completo, teste no navegador com login, falhas de PUT/CORS, envio de imagem acima de 4,5 MB, limpeza de reserva abandonada e visualização administrativa, antes do cutover. Nenhuma mídia real transferida.

## Proteção contra sobrescrita e testes — 13/11/2026 (sem cutover)

- Todos os PUTs simples R2 de mídias novas têm assinatura e envio do cabeçalho `If-None-Match: *`. R2 rejeita com HTTP 412 a tentativa de sobrescrever um objeto já existente durante a validade da URL.
- A conclusão de fotos multipartes também usa a condição create-only, assinada pelo servidor diretamente em `CompleteMultipartUpload`. As partes isoladas não usam a condição: só a conclusão publica o arquivo.
- No Cloudflare, o CORS de `fotura-media` passou a permitir `If-None-Match`, além de `Content-Type`. O bucket continua privado, `r2.dev` desligado, com as duas origens anteriormente permitidas e apenas GET/HEAD/PUT.
- Criado teste E2E focalizado no bloqueio de APIs R2 sem autenticação e com `Origin` externo, executado em uma etapa independente antes da suíte geral, usando credenciais Supabase sintéticas.
- **Limites:** o teste de segurança usa requisições não autenticadas; não valida PUT S3 real nem a confirmação de mídia de usuário. Um 412 após falha de rede deve levar à reconciliação do estado por HEAD/reserva e não ao overwrite.
- Nenhuma mídia legada foi copiada, nenhuma migração foi aplicada ao Postgres de produção e nenhuma flag R2 foi ativada.
