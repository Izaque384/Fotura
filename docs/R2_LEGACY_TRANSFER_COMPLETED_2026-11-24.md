# Fotura — transferência integral verificada do Storage legado para Cloudflare R2

Registro operacional: 2026-11-24 (UTC). Acervo em produção.

## Resultado verificado

| Origem (Supabase Storage) | Objetos copiados | Bytes |
| --- | ---: | ---: |
| fotos (originais e miniaturas) | 1.212 | 1.664.649.601 |
| abertura-videos | 2 | 11.969.667 |
| marca (11 usuários + 1 banner da landing) | 12 | 11.013.166 |
| client-avatars | 2 | 49.430 |
| **Total acervo legado** | **1.228** | **1.687.681.864** |

- Antes do legado, o R2 continha 200 objetos registrados e verificados (310.844.540 bytes).
- Depois da transferência: bucket privado `fotura-media` com **1.428 objetos** e **1.998.526.404 bytes** (listagem R2, 2 páginas).
- Reconciliação exata: 1.687.681.864 + 310.844.540 = 1.998.526.404 bytes.
- Registro privado `public.fotura_media_objects`: 1.427 entradas, das quais 1.227 correspondem a objetos legados com owner UUID. O banner legado `marca/landing/fotura-wedding-sunset-generated.png` é uma mídia pública da plataforma sem proprietário de estúdio; foi copiado, verificado e servido exclusivamente pelo endpoint fixo `/api/marca/landing`, não pelo registro de estúdio.
- Todos os 1.227 arquivos legados de contas de usuário foram registrados após download de retorno do R2 e comparação SHA-256 dos bytes com a fonte, além de checagem de comprimento. O banner teve a mesma verificação sem entrada no registro de usuário.
- O projeto de casamento Roberto & Ferlaína foi prioritário: 66 originais + 66 miniaturas das seis galerias transferidos e verificados.
- Três referências de `perfis.logo_url` que apontavam diretamente ao Supabase Storage foram atualizadas para `/api/marca/{owner}/{filename}` após verificação das cópias. Uma URL pública foi consultada e respondeu HTTP 200.
- A URL hardcoded do banner em `app/app/lavanda-moderna.css` passou a usar `/api/marca/landing` (PR #166). A rota foi consultada e apontou para o objeto privado assinado do R2.
- O código de novos uploads já estava configurado para gravar exclusivamente no R2 desde 13/11/2026.
- PR #165 implementou a migração autenticada usando Vault HMAC de curta duração e leitura/escrita privadas. Após o uso, a rota operacional temporária foi removida por segurança nesta finalização.

## Limpeza definitiva concluída — 2026-11-24

A pedido do proprietário, os 1.228 objetos antigos foram removidos por **Supabase Storage API** (SDK service_role, método `remove`), nunca por `DELETE FROM storage.objects`.

- Antes da exclusão, PR #168 corrigiu o dashboard para ler capas por um endpoint R2 privado autenticado e corrigiu as funções SQL `definir_capa_galeria` e `billing_gallery_usage_backend` para reconhecer objetos R2 sem manter a cópia no Storage antigo.
- A migração de banco sincronizou a data de criação de 1.227 objetos legados com a data original anterior à exclusão para preservar a ordem de fotos.
- Uma miniatura de teste foi apagada e sua cópia no R2 baixada e verificada com 23.370 bytes íntegros, enquanto o registro privado foi preservado.
- Todos os 606 thumbs, todos os 606 originais, os 2 vídeos MP4, os 11 arquivos de marca de estúdios, os 2 avatares e o banner especial da landing foram removidos da origem. Total **1.228 arquivos**, com confirmação HTTP 200 dos lotes e sem falhas nos resultados.
- A consulta SQL final ao `storage.objects` retornou **0 arquivos, 0 bytes**.
- `public.fotura_media_objects` permaneceu com **1.427 registros** (incluindo 1.412 fotos/miniaturas, 2 vídeos, 11 marcas e 2 avatares).
- O bucket privado Cloudflare `fotura-media` foi recontado fisicamente após a exclusão, com **1.428 objetos, 1.998.526.404 bytes**, incluindo o banner da plataforma não registrado como mídia de estúdio.
- A organização continua Supabase Pro; o banco PostgreSQL, Auth, tabelas e permissões continuam no Supabase. Confirmadas 14 galerias no banco; as 6 galerias do casamento Roberto & Ferlaína possuem 132 registros R2 (66 originais e 66 miniaturas).
- Três logotipos permanecem apontando para a rota privada de mídia no Fotura. O banner `/api/marca/landing` e um logotipo foram consultados via HTTP 200.
- A rota privilegiada de limpeza `/api/internal/r2-legacy-cleanup` foi removida do repositório na PR de finalização, após a execução.

### Atenções posteriores

1. O dashboard do Supabase pode mostrar valores históricos de armazenamento médio até o ciclo de cobrança atualizar. A consulta direta ao inventário `storage.objects` já confirmou **0 bytes atualmente armazenados**.
2. A migração e a limpeza não modificaram as contas de Auth nem as galerias. Entretanto, a navegação completa em dispositivos físicos de clientes (especialmente iPhone/Safari, reprodução de vídeo, ZIP e PIN) não foi homologada manualmente nesta operação; recomenda-se um teste final de entrega real.
3. O R2 agora é a única cópia de mídia mantida na infraestrutura de armazenamento da aplicação. Para fotos irrepetíveis de clientes, criar um backup independente adicional, fora do próprio R2, antes de confiar nele como única cópia de longo prazo.
4. A assinatura Supabase Pro **não foi cancelada**; isso é uma decisão de faturamento separada, e Auth/PostgreSQL continuam dependentes do Supabase.
