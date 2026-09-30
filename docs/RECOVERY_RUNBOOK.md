# Fotura — Recovery Runbook

Última revisão: 30/09/2026.

## Objetivo

Este documento define como validar recuperação do Fotura sem usar a produção como ambiente de teste destrutivo.

## Estado atual da infraestrutura

- O projeto Supabase de produção está no plano Free.
- O plano Free não oferece uma janela garantida de backups diários restauráveis pelo painel. A documentação do Supabase recomenda manter dumps lógicos externos para projetos Free.
- Backups de banco não restauram os objetos binários do Supabase Storage. Fotos e logos exigem estratégia de cópia própria.
- O Fotura possui o RPC service-only `operational_recovery_snapshot_backend()`, que produz um snapshot comparável de contagens do banco e de objetos/bytes dos buckets `fotos` e `marca`.

## Snapshot de referência

Antes de qualquer operação de backup, migração ou restore, gerar e guardar o resultado de:

`select public.operational_recovery_snapshot_backend();`

O snapshot contém:
- perfis;
- assinaturas;
- clientes;
- galerias;
- seleções;
- vendas;
- auditoria;
- quantidade e bytes dos objetos de fotos;
- quantidade e bytes dos objetos de marca.

O mesmo snapshot deve ser gerado depois do restore. Diferenças devem ser explicadas antes de considerar a recuperação concluída.

## Backup recomendado enquanto o projeto permanecer no Free

1. Fazer dump lógico periódico do Postgres usando Supabase CLI/pg_dump em ambiente confiável.
2. Criptografar o arquivo antes de armazená-lo fora do provedor.
3. Manter ao menos duas cópias em destinos independentes.
4. Copiar separadamente os objetos dos buckets privados `fotos` e `marca`.
5. Registrar data/hora, tamanho, hash e snapshot operacional junto a cada conjunto de backup.
6. Nunca guardar service-role keys dentro do arquivo de backup ou no repositório.

## Frequência mínima sugerida

Enquanto houver uso comercial:
- banco: diário;
- Storage: diário ou incremental;
- antes de migrações destrutivas: backup manual adicional.

O RPO real do Fotura será igual ao intervalo entre os backups externos enquanto o projeto estiver no plano Free.

## Restore drill seguro

Não executar restore destrutivo diretamente em produção para fins de teste.

Para um drill completo:
1. criar um ambiente isolado/staging;
2. restaurar o dump lógico nesse ambiente;
3. restaurar uma cópia dos objetos de Storage;
4. aplicar segredos exclusivamente de teste;
5. gerar o snapshot operacional no ambiente restaurado;
6. comparar com o snapshot salvo no momento do backup;
7. validar manualmente:
   - autenticação;
   - isolamento entre duas contas;
   - listagem de clientes;
   - listagem e abertura de galeria;
   - seleção e comentários;
   - assinatura de uma foto;
   - entrega final;
   - leitura da assinatura/plano;
8. manter Stripe, Resend e outros provedores externos em modo de teste ou desabilitados durante o drill;
9. destruir o ambiente temporário ao concluir.

## Critérios de sucesso do restore

Um restore só é considerado válido quando:
- o schema/migrations está consistente;
- as contagens críticas conferem com o snapshot esperado;
- os objetos de Storage esperados estão presentes;
- duas contas distintas permanecem isoladas;
- uma galeria de prova e uma de entrega abrem corretamente;
- nenhuma cobrança, e-mail ou webhook real é disparado pelo ambiente restaurado.

## Produção paga

Ao migrar o Fotura para Pro ou superior, habilitar e revisar os backups oferecidos pelo Supabase e executar um restore drill em ambiente isolado. Se PITR for contratado, registrar formalmente RPO/RTO e testar o processo de recuperação.

## Incidente em produção

1. interromper mudanças destrutivas;
2. registrar horário aproximado do incidente;
3. capturar snapshot operacional atual;
4. preservar logs e request IDs relacionados;
5. identificar o último backup conhecido como íntegro;
6. restaurar primeiro em ambiente isolado sempre que possível;
7. comparar snapshots;
8. somente depois planejar a recuperação da produção e a janela de indisponibilidade.

## Observação sobre Storage

Backups do Postgres não equivalem a backup das fotos. O banco contém metadados, enquanto os arquivos ficam no Storage. A estratégia de recuperação do Fotura deve sempre tratar banco e Storage como dois ativos separados.
