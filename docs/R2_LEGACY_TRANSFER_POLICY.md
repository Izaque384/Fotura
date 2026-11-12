# Fotura — política de transferência das mídias legadas (sem custo inesperado)

Data desta decisão: 12/11/2026.

## Bloqueio de calendário
- **NÃO iniciar cópia de fotografias, miniaturas, vídeos, marcas ou avatares reais antes de 23/11/2026.**
- 22/11 foi apontado como possível encerramento do ciclo da Supabase, **ainda não confirmado pela leitura de faturamento**.
- Em 23/11 ou posteriormente, primeiro verificar no dashboard da Supabase o campo `Upcoming Invoice` / fim do ciclo e o uso de **Egress GB (uncached)**. Se a franquia não tiver sido renovada, o bloqueio continua.
- Este documento registra uma regra de *não execução*, **não agenda nem executa automaticamente a migração no dia 23**.

## Por que bloquear?
- A organização está no **plano Free**, com 5 GB não cacheados e 5 GB cacheados de egress por ciclo, contados separadamente. O download dos arquivos legados do Storage em geral adicionará uso de egress não cacheado.
- Na conta Free, ultrapassar o limite acarreta notificações e pode resultar em **restrições de serviço**, não uma cobrança automática por GB como em planos pagos. O risco operacional é grave para um SaaS com galerias ativas.
- O inventário observado foi de **1.228 arquivos**: `fotos` 1.212, `abertura-videos` 2, `marca` 12, `client-avatars` 2, `feedback-anexos` 0. A quantidade/bytes devem ser recontados imediatamente antes de qualquer cópia.

## Pré-condições do primeiro lote
1. CI de regressão e migrações aprovado; todos os provedores de mídia e operações de limpeza/remoção devem estar integrados. Não copiar de forma indiscriminada para ocultar bloqueadores.
2. Verificar, **com dados atuais**, que o reset do ciclo aconteceu e que há egress não cacheado suficiente com margem para galerias reais, autenticação, Edge Functions e tentativas de repetição.
3. Limitar o lote inicial a **pequenos arquivos próprios de teste**, sem fotos de clientes. Não criar cópias de fotos reais até validar autorização e integridade.
4. Antes do primeiro arquivo de cliente, registrar inventário com bucket, caminho, tamanho, ETag/hash original quando disponível e estado de migração. Não usar DELETE de origem.
5. Para cada cópia real: baixar **uma única vez** do Supabase, enviar ao Cloudflare R2 privado, verificar bytes e hash de ponta a ponta (comparar upload com download do R2), registrar a cópia no banco **somente após verificação**. Repetir somente itens falhados.
6. Iniciar lotes pequenos e medir o consumo real de egress a cada lote. Interromper se não for possível obter a medição atual ou se o orçamento reservado para usuários cair abaixo da margem prevista.
7. Nunca desativar leitura legada até todas as referências estarem no R2 e a suíte de galerias/ZIP/PIN/vídeo/iPhone estar verde.
8. Conservar os arquivos legados pelo período de retenção aprovado; nenhuma exclusão automática por causa de uma cópia aparente.

## Sem autorização de branch paga
O usuário não autorizou criar branch de teste Supabase com cobrança de US$ 0,01344/h. Usar CI PostgreSQL descartável e prévia Vercel enquanto possível; execução de DDL, transferência e mudança de credenciais na produção estão **fora de escopo nesta etapa**.

Fonte oficial de cobrança e restrições:
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://supabase.com/docs/guides/platform/billing-faq
