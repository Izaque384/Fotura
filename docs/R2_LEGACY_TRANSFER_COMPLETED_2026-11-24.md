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

## Garantias e pendências

1. **Nenhum objeto original foi apagado no Supabase Storage nesta migração.** Permanecem 1.228 objetos como retenção de segurança. Isso mantém o consumo antigo do Storage contabilizado e pode impedir downgrade seguro imediato ao plano Free.
2. Para reduzir definitivamente o uso faturado no Supabase Storage, preparar remoção pelo SDK Storage e apenas após testes de galerias reais, links públicos, downloads, ZIP, vídeos em Safari/iPhone, marcas, avatares, confirmação do usuário e plano de retenção/backup independente. **Nunca apagar diretamente linhas de `storage.objects` por SQL.**
3. Banco, Auth, metadados, permissões e registros permanecem no Supabase. A migração é somente dos bytes de mídia.
4. Foi realizada verificação por arquivo (SHA-256) e reconciliação de contagem e bytes. Testes de navegação no dispositivo real do cliente não foram executados neste procedimento.