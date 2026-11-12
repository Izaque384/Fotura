# Fotura — migração controlada de mídia para Cloudflare R2

Status: **etapa 1 (preparação somente; sem migração, sem cutover)**.

## Verificações realizadas em 2026-11-12
- Bucket Cloudflare **fotura-media** criado em Standard, sem domínio público; CORS de leitura restrito ao domínio do Fotura.
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
- **R2_ACCOUNT_ID**: ID da conta Cloudflare (servidor).
- **R2_MEDIA_BUCKET**: fotura-media.
- **R2_ACCESS_KEY_ID**, **R2_SECRET_ACCESS_KEY**: credenciais S3 específicas do bucket; exclusivamente servidor.
- Até o cutover, os novos uploads, listagens, exclusões, movimentações e limpeza continuam no Supabase.

## Escopo já preparado
- URLs de leitura para downloads autorizados e galeria pública (miniaturas e originais), abertura de projetos (fotos/vídeos) e miniaturas do painel.
- Roteamento por objeto: R2 **somente** quando existir entrada verificada no registro privado e a flag estiver ativada; caso contrário, Supabase.
- Migração SQL adiciona apenas tabela privada, sem alterar tabelas/fotos existentes.

## Escopo ainda obrigatório antes de ativar a migração
1. Credenciais de serviço R2 com permissões mínimas; validar GET/HEAD/PUT em arquivo descartável.
2. Upload original em partes (resumível ou multipart), miniatura, confirmação e limites por usuário/plano; corrigir CORS.
3. Listagem e contagens independentes de storage.objects/RPC legado; manter metadados para a página pública e painel.
4. Entrega final, alteração de pasta e capa, duplicidade de nomes, vídeo cinematográfico, conversão com marca d'água e imagem de prévia social.
5. Remoção, cancelamento, limpeza automática, exclusão de conta, uso justo, billing e recuperação; garantir consistência entre provedores.
6. Testes reais em prévia, com uma galeria de teste pequena, e testes de senha, PIN, expiração, downloads em qualidade original e iPhone.
7. Copiar em lotes pequenos após a renovação da franquia, verificar cada objeto (tamanho/checksum), registrar sucesso e **preservar original**.
8. Só então ativar as leituras no R2 gradualmente, monitorar erros/egress/operadores e decidir por novas gravações.
9. Remover cópias antigas apenas após janela de retenção e confirmação explícita.

## Reversão
Desligar **FOTURA_R2_READ_ENABLED**. Com os arquivos legados preservados no Supabase, as leituras voltam imediatamente à origem anterior. Nunca contar com a reversão da aplicação para recuperar objetos já excluídos.

## Notas sobre custos
R2 não cobra tarifa por egress, mas cobra armazenamento e operações além da franquia; transferir arquivos existentes **para fora do Supabase pode consumir o Egress do Supabase**.
