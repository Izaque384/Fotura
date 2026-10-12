export const MAX_ARQUIVOS_POR_LOTE = 500;
export const MAX_TAMANHO_ARQUIVO = 50 * 1024 * 1024;
export const ACCEPT_FOTOS = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const MIME_POR_EXTENSAO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type ArquivoValidavel = Pick<File, "name" | "type" | "size"> & Partial<Pick<File, "lastModified">>;

export function identidadeArquivo(arquivo: ArquivoValidavel) {
  return `${arquivo.name}\u0000${arquivo.type}\u0000${arquivo.size}\u0000${arquivo.lastModified ?? 0}`;
}

export function mesclarArquivosSelecionados<T extends ArquivoValidavel>(atuais: T[], novos: T[], limite = MAX_ARQUIVOS_POR_LOTE) {
  const resultado = [...atuais];
  const chaves = new Set(resultado.map(identidadeArquivo));
  const duplicados: T[] = [];
  const excedentes: T[] = [];

  for (const arquivo of novos) {
    const chave = identidadeArquivo(arquivo);
    if (chaves.has(chave)) { duplicados.push(arquivo); continue; }
    if (resultado.length >= limite) { excedentes.push(arquivo); continue; }
    chaves.add(chave);
    resultado.push(arquivo);
  }

  return { arquivos: resultado, duplicados, excedentes };
}

export function validarArquivo(arquivo: ArquivoValidavel): string | null {
  const nome = arquivo.name.trim();
  if (!nome) return "arquivo sem nome";
  if (nome.length > 180) return "nome do arquivo muito longo";
  if (/[\/\\\u0000-\u001f\u007f]/.test(nome)) return "nome do arquivo inválido";

  const ponto = nome.lastIndexOf(".");
  if (ponto <= 0 || ponto === nome.length - 1) return "extensão ausente ou inválida";

  const extensao = nome.slice(ponto + 1).toLowerCase();
  const mimeEsperado = MIME_POR_EXTENSAO[extensao];
  if (!mimeEsperado) return "formato não aceito (use JPG, PNG ou WebP)";
  if (arquivo.type.toLowerCase() !== mimeEsperado) return "tipo do arquivo não corresponde à extensão";
  if (arquivo.size === 0) return "arquivo vazio";
  if (arquivo.size > MAX_TAMANHO_ARQUIVO) return "arquivo maior que 50 MB";

  return null;
}
