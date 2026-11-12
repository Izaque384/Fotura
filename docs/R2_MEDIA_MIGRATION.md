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
- Enquanto o piloto permanecer desativado, **todos os uploads continuam usando Supabase**, assim como exclusões, movimentações e limpeza.

## Escopo já preparado
- URLs de leitura para downloads autorizados e galeria pública (miniaturas e originais), abertura de projetos (fotos/vídeos) e miniaturas do painel.
- Roteamento por objeto: R2 **somente** quando existir entrada verificada no registro privado e a flag estiver ativada; caso contrário, Supabase.
- Migração SQL adiciona apenas tabela privada, sem alterar tabelas/fotos existentes.

## Etapa 2 preparada no código (sem ativação)
- Endpoint autenticado `POST /api/fotos/r2` gera URL temporária para cada foto e sua miniatura JPEG, validando titularidade da galeria, etapa, tipo, tamanho, franquia de uso justo, armazenamento e limite de fotos. A confirmação usa HEAD assinado para verificar tipo e bytes antes de registrar; uma segunda checagem de cotas acontece antes da confirmação.
- O endpoint está bloqueado **fora de prévia** e também permanece desativado por flag. Não enviar arquivos reais antes das validações abaixo.
- `app/lib/r2-photo-upload-client.ts` envia por PUT com progresso e repetição curta; para fotos maiores que **6 MB** o fluxo atual continua usando TUS resumível no Supabase. Piloto sem retomada parcial de PUT: não substituir TUS para arquivos grandes sem multipart/resume.
- As páginas de envio principal e de entrega final já contêm o fallback condicional ao fluxo atual.
- O catálogo híbrido mescla fotos de ambos os provedores, e o workspace reconhece fotos R2 nas capas e abertura. O gerenciador **bloqueia movimentar arquivos R2** antes de haver cópia verificada e rollback seguro.
- Duas migrações SQL **versionadas, não aplicadas**: registro privado de objetos R2 e rotina transacional de confirmação com metadados e uso justo, além da contagem de bytes exclusivos do R2 nos limites da conta.
- CORS e CSP atualizados para o host S3 privado do R2. O token fica restrito ao bucket e suas variáveis apenas na prévia.
- Verificação da prévia com o piloto desligado: GET /api/fotos/r2 retornou `enabled:false`, conforme esperado.
- **Não executar a migração nem habilitar flags** antes de: (1) revisar/aplicar SQL em janela controlada e testar RLS/RPC, (2) testar foto sintética de ponta a ponta e integridade, (3) completar exclusão e limpeza R2 e (4) corrigir caminhos que ainda dependem exclusivamente de `storage.objects`.

## Escopo ainda obrigatório antes de ativar a migração
1. **Concluído para a prévia:** credencial restrita ao bucket e teste sintético de PUT/GET/HEAD/DELETE; **falta testar o fluxo de galeria autenticado**.
2. **Preparado em piloto (até 6 MB, desativado):** foto original, miniatura, confirmação e limites; falta teste real em navegador e multipart/resumível para maiores.
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
