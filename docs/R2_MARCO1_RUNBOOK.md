# Fotura — marco 1: Cloudflare R2 oficial para arquivos NOVOS

Estado em 13/11/2026: **PREPARADO NO CÓDIGO, AINDA NÃO ATIVADO NA PRODUÇÃO**. Este documento é um gate operacional, não uma autorização para SQL produtivo, merge ou alteração de flags.

## Escopo do primeiro marco
- Fotos (originais e thumbnails), vídeos MP4 de abertura, logos, avatares e anexos de feedback novos vão **exclusivamente para R2 privado**.
- Mídias antigas continuam legíveis no Supabase Storage via adaptador híbrido; não copiar nem excluir fotografias dos clientes nesta fase.
- Supabase permanece para Auth, banco e referências legadas; nenhum fallback de **gravação nova** para Supabase após o cutover.
- Marco 2 (cópia integral do legado) fica para 23/11/2026 ou depois, apenas após confirmar renovação e folga do egress Supabase; nunca automático.

## Evidência já obtida
1. GitHub Actions valida SQL e transações sintéticas em PostgreSQL 17 descartável, sem acesso à produção.
2. Suíte E2E geral passou **174/174**, security gate **4/4**, build e auditoria de dependências aprovados no commit `01806f07` (validar novamente o HEAD antes da virada).
3. Cloudflare R2 aceitou PUT/GET/DELETE de um arquivo sintético pequeno via API de objetos; verificação integral do conteúdo passou e listagem posterior confirmou zero objetos. **Isto não testa S3 SigV4 nem upload autenticado do Fotura**.
4. Preflight SQL somente leitura: tabelas, colunas, funções do backend de vídeo, limpeza, pg_net e hmac presentes em produção (ver `tests/sql/r2_release_schema_preflight.sql`). As tabelas novas R2 continuam ausentes por segurança.
5. CORS privado de `fotura-media` restringe origens à produção e à prévia de teste; GET/HEAD/PUT e headers Content-Type/If-None-Match. Não publicar r2.dev/custom domain para mídias privadas.

## Gate obrigatório antes de qualquer publicação
- [ ] Suíte E2E e segurança **verdes no HEAD exato** do PR, incluindo duas simulações da configuração final em CI.
- [ ] Homologação realmente isolada com **auth + esquema Supabase compatíveis**, sem criar branch paga, nem usar dados de clientes.
- [ ] Executar todos os SQLs R2 no banco **isolado** e conferir grants/RLS/transações, storage fair-use e jobs.
- [ ] Fazer com **usuário de teste**: imagem pequena/50 MB multipart e retomada, thumb, entrega, ZIP, download privado, marca d'água, seleção, capa, MP4 no iPhone, logo, avatar, feedback e exclusões.
- [ ] Validar assinaturas SigV4 reais PUT/GET/HEAD com `If-None-Match: *`, preflight CORS, HTTP 412, arquivo duplicado, timeout do cliente e resposta ambígua.
- [ ] Exercitar limpeza órfã da Edge Function com credenciais de escopo mínimo, cancelamento, upload em trânsito, leases expirados, GET privado e HEAD 404 **antes de ACK**.
- [ ] Garantir que nenhuma operação gera transferência do conteúdo legado e que nenhuma informação de outros clientes pode ser assinada.
- [ ] Plano de operação testado: backups do banco, observabilidade, rate limit, bloqueio seguro de uploads e recuperação de links já R2.

## Sequência de ativação (SOMENTE depois de todo gate verde)
1. Validar HEAD, backup, inventário e preflight SQL read-only; registrar responsável pela operação e janela de monitoramento.
2. Preparar migrações versionadas R2 na produção com janela planejada; aplicar **somente com autorização específica e após homologação**. Confirmar tabelas, RLS, grants e funções antes de liberar qualquer upload.
3. Configurar Edge Function de limpeza e segredos R2 restritos à produção; não reaproveitar chave privilegiada no cliente. Confirmar que todos os fluxos usam provider único.
4. Construir/deployar o código revisado **sem habilitar o cutover**; manter leitura legada e funções antigas disponíveis. Se a aplicação exigir que os toggles estejam simultâneos no primeiro deploy, planejar deploy atômico, sem janela em que apenas uma classe de mídia esteja ativa.
5. Em mudança coordenada habilitar as flags `FOTURA_R2_READ_ENABLED=true`, `FOTURA_R2_UPLOAD_ENABLED=true`, `FOTURA_R2_FINAL_CUTOVER=true` **somente após confirmação do ambiente**; acompanhar novas reservas/registros/URLs.
6. Testar primeiro arquivos sintéticos e acompanhar primeiros uploads, sem transferir mídias antigas. Registrar uso, falhas e latência; disponibilizar logs sem dados de clientes.
7. Se houver falhas, bloquear novas escritas com **fail-closed** mantendo leitura R2. NÃO retornar à versão antiga/main que grava diretamente no Supabase e desconhece registros R2, e NÃO desligar leitura R2 enquanto existirem objetos exclusivos.

## Bloqueios explícitos
- Nada de branch paga Supabase sem aceitação de custo.
- Nada de SQL/merge/flags no banco ou na aplicação de produção antes de testes reais e liberação.
- Nada de cópias de arquivos reais antes de 23/11/2026, e mesmo depois só com egress comprovado.
- Nunca excluir a origem Supabase porque a cópia R2 aparentemente funcionou.
- Não tratar a aprovação de CI simulada ou API Cloudflare como comprovação de navegador/S3 real.

## Edge Function publicada no Supabase
- Auditoria em 13/11: `storage-cleanup` no Supabase de produção continua **ACTIVE version 1**, sem a rotina de claim/ack R2 da branch. Não a substituir até testar o trabalhador no ambiente isolado com migrações e segredos de escopo mínimo.
- CI passa a executar `deno check` da implementação versionada, sem acesso a credenciais nem deploy. Typecheck não substitui execução com leases e objetos remotos.
