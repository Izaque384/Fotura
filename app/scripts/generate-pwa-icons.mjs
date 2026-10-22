/** Atualiza os ícones estáticos do PWA a partir da marca vetorial oficial.
 * Executado no prebuild/predev para que a splash do Android use a arte atual.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const raiz = process.cwd();
const dir = path.join(raiz, "public");
const corFundo = "#111222";
const vetor = await readFile(path.join(dir, "favicon.svg"));

for (const tamanho of [192, 512]) {
  // SVG contém margens originais; trim() remove somente a área transparente.
  const logo = await sharp(vetor)
    .trim()
    .resize({ width: Math.round(tamanho * 0.54) })
    .png()
    .toBuffer();

  const info = await sharp(logo).metadata();
  if (!info.width || !info.height) throw new Error("Falha ao gerar ícone do Fotura.");

  // A cor do fundo é igual à splash gerada pelo Android; o antigo quadrado
  // preto grande deixa de sobressair. A margem preserva a safe area maskable.
  const imagem = await sharp({
    create: {
      width: tamanho,
      height: tamanho,
      channels: 4,
      background: corFundo,
    },
  })
    .composite([{
      input: logo,
      left: Math.floor((tamanho - info.width) / 2),
      top: Math.floor((tamanho - info.height) / 2),
    }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Mantém o caminho antigo para compatibilidade com instalações prévias,
  // mas publica um caminho NOVO no manifesto para impedir cache da arte anterior.
  await Promise.all([
    writeFile(path.join(dir, `icon-${tamanho}.png`), imagem),
    writeFile(path.join(dir, `fotura-pwa-${tamanho}-20261022.png`), imagem),
  ]);
  console.log(`PWA Fotura: ícones ${tamanho}x${tamanho} gerados (novo e legado).`);
}
