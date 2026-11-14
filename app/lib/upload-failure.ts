/**
 * Explicações seguras para falhas do navegador/armazenamento.
 * Nunca apresenta URLs assinadas, credenciais ou mensagens brutas de provedores.
 */
export function explicarFalhaUpload(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : "";

  const conhecidas = [
    "Franquia mensal de envios indisponível.",
    "Franquia mensal de envios atingida.",
    "Limite de armazenamento do plano atingido.",
    "Limite de armazenamento atingido.",
    "Galeria indisponível para envio.",
    "Há muitos envios aguardando confirmação. Conclua ou cancele os anteriores.",
    "Não foi possível confirmar a integridade dos arquivos enviados.",
    "Não foi possível preparar uma miniatura.",
    "Arquivo incompatível com o limite do Fotura.",
    "Não foi possível verificar os envios pendentes.",
    "Limite temporário de operações de upload atingido.",
    "Limite de solicitações atingido.",
  ];
  const conhecida = conhecidas.find((item) => mensagem.includes(item));
  if (conhecida) return conhecida;

  const status = mensagem.match(/\b(?:HTTP|status|response code)\s*:?\s*([45]\d\d)\b/i)?.[1];
  if (status === "401") return "A autorização para enviar fotos expirou. Entre novamente na sua conta.";
  if (status === "403") return "O armazenamento recusou o acesso (HTTP 403). Verifique os limites e as permissões da conta.";
  if (status === "413") return "O armazenamento recusou o arquivo por tamanho excessivo (HTTP 413).";
  if (status) return `O armazenamento não concluiu o envio (HTTP ${status}).`;

  if (/network|falha de rede|failed to fetch|fetch failed|xmlhttprequest|timeout|tempo esgotado|cors/i.test(mensagem)) {
    return "A conexão com o armazenamento falhou. Verifique a rede e tente novamente.";
  }
  if (/sessão expirada/i.test(mensagem)) return "Sua sessão expirou. Entre novamente para enviar fotos.";
  return "O armazenamento não concluiu a transferência.";
}
