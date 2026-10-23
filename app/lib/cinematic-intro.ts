export type EstiloAbertura = "cinematografico" | "minimalista" | "editorial";

export type FotoAbertura = { pastaId: string; arquivo: string };
export type ConfigAbertura = {
  ativo: boolean;
  estilo: EstiloAbertura;
  duracao: 15 | 21 | 30;
  frase: string;
  fotos: FotoAbertura[];
  versao: string;
};

export type FotoAberturaPublica = FotoAbertura & { url: string };
export type AberturaPublica = Omit<ConfigAbertura, "fotos"> & { fotos: FotoAberturaPublica[] };

export const ABERTURA_PADRAO: ConfigAbertura = {
  ativo: false,
  estilo: "cinematografico",
  duracao: 21,
  frase: "Alguns momentos merecem ser revividos.",
  fotos: [],
  versao: "1",
};

const estilos: EstiloAbertura[] = ["cinematografico", "minimalista", "editorial"];
const duracoes = [4, 6, 8, 12, 16, 15, 21, 30];
// Valores anteriores permanecem válidos no banco e ganham uma apresentação
// mais contemplativa sem exigir migração ou edição dos projetos publicados.
function duracaoSuave(valor: unknown): 15 | 21 | 30 {
  if (valor === 4 || valor === 8 || valor === 15) return 15;
  if (valor === 16 || valor === 30) return 30;
  return 21; // 6, 12, 21 ou configuração ausente: 7s por etapa
}

export function lerAbertura(valor: unknown): ConfigAbertura {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { ...ABERTURA_PADRAO, fotos: [] };
  const c = valor as Record<string, unknown>;
  const fotos = Array.isArray(c.fotos)
    ? c.fotos.slice(0, 3).filter((item): item is FotoAbertura => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const f = item as Record<string, unknown>;
      return typeof f.pastaId === "string" && /^[0-9a-f-]{36}$/i.test(f.pastaId)
        && typeof f.arquivo === "string" && f.arquivo.length > 0
        && f.arquivo.length <= 255 && !/[\\/\\\\]/.test(f.arquivo);
    }).map((f) => ({ pastaId: f.pastaId, arquivo: f.arquivo }))
    : [];
  return {
    ativo: c.ativo === true,
    estilo: estilos.includes(c.estilo as EstiloAbertura) ? c.estilo as EstiloAbertura : "cinematografico",
    duracao: duracaoSuave(c.duracao),
    frase: typeof c.frase === "string" ? c.frase.slice(0, 140) : ABERTURA_PADRAO.frase,
    fotos,
    versao: typeof c.versao === "string" ? c.versao.slice(0, 40) : "1",
  };
}

export function validarAbertura(valor: unknown): ConfigAbertura | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const v = valor as Record<string, unknown>;
  if (typeof v.ativo !== "boolean" || !estilos.includes(v.estilo as EstiloAbertura) ||
    !duracoes.includes(v.duracao as number) || typeof v.frase !== "string" || v.frase.length > 140 ||
    !Array.isArray(v.fotos) || v.fotos.length > 3) return null;
  const config = lerAbertura(v);
  if (config.fotos.length !== v.fotos.length) return null;
  const unicos = new Set(config.fotos.map((f) => `${f.pastaId}/${f.arquivo}`));
  if (unicos.size !== config.fotos.length || (config.ativo && config.fotos.length === 0)) return null;
  return { ...config, frase: config.frase.trim(), versao: new Date().toISOString() };
}
