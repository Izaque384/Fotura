/**
 * Verifica a estrutura do MP4, não apenas a extensão/MIME.
 * MP4/HEVC pode funcionar no iPhone e falhar no Android/Chrome.
 * Para abertura pública, exigimos H.264 AVC em MP4 otimizado (moov antes de mdat).
 */
export function validarMp4ParaWeb(bytes: Uint8Array): string | null {
  if (bytes.length < 32) return "O vídeo não contém um arquivo MP4 válido.";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const texto = (inicio: number) => String.fromCharCode(...bytes.subarray(inicio, inicio + 4));
  if (texto(4) !== "ftyp") return "O arquivo não é um MP4 válido.";
  let moov = -1;
  let fimMoov = -1;
  let mdat = -1;
  for (let pos = 0; pos + 8 <= bytes.length;) {
    let size = view.getUint32(pos);
    let header = 8;
    if (size === 1) {
      if (pos + 16 > bytes.length) break;
      const high = view.getUint32(pos + 8);
      const low = view.getUint32(pos + 12);
      size = high * 2 ** 32 + low;
      header = 16;
    } else if (size === 0) size = bytes.length - pos;
    if (!Number.isSafeInteger(size) || size < header || pos + size > bytes.length) break;
    const kind = texto(pos + 4);
    if (kind === "moov") { moov = pos; fimMoov = pos + size; }
    if (kind === "mdat" && mdat === -1) mdat = pos;
    pos += size;
  }
  if (moov < 0 || mdat < 0) return "Arquivo MP4 incompleto ou inválido. Exporte novamente.";
  if (moov > mdat)
    return "O MP4 precisa estar otimizado para web (Fast Start). Exporte novamente em H.264 com Otimizar para Web.";
  let h264 = false;
  let codecDiferente = false;
  for (let mark = moov + 8; mark + 20 <= fimMoov; mark++) {
    if (texto(mark) !== "stsd" || mark < 4) continue;
    const inicio = mark - 4;
    const size = view.getUint32(inicio);
    if (size < 24 || inicio + size > fimMoov) continue;
    const quantidade = view.getUint32(mark + 8);
    if (quantidade < 1 || quantidade > 32) continue;
    let entry = mark + 12;
    for (let i = 0; i < quantidade; i++) {
      if (entry + 8 > inicio + size) break;
      const tamanho = view.getUint32(entry);
      if (tamanho < 8 || entry + tamanho > inicio + size) break;
      const codec = texto(entry + 4);
      if (codec === "avc1") {
        h264 = true;
        // Alguns H.264 Hi10P/4:2:2 funcionam no desktop, mas falham no mobile.
        for (let at = entry + 8; at + 7 < entry + tamanho; at++) {
          if (texto(at) === "avcC") {
            const perfil = bytes[at + 5];
            if (![66, 77, 100].includes(perfil))
              return "Use H.264 de 8 bits (Baseline, Main ou High); este perfil não é compatível com todos os aparelhos.";
            break;
          }
        }
      } else if (["avc3", "hvc1", "hev1", "av01", "vp09", "mp4v", "dvh1", "dvhe"].includes(codec)) {
        codecDiferente = true;
      }
      entry += tamanho;
    }
  }
  if (!h264)
    return codecDiferente
      ? "Este MP4 usa um codec não recomendado. Exporte em H.264 (AVC) para iPhone, Android e computadores."
      : "Não foi possível confirmar o codec H.264. Exporte como MP4 H.264 (AVC), com Fast Start.";
  return null;
}
