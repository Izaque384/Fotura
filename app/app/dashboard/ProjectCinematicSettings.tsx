"use client";

import { useEffect, useState } from "react";
import type { ConfigAbertura, FotoAbertura, FotoAberturaPublica } from "../../lib/cinematic-intro";
import ProjectCinematicIntro from "../components/ProjectCinematicIntro";

type Pasta = { id: string; titulo: string; visivel: boolean; qtd: number };
type Preview = { nome: string; url: string };
type Props = {
  projeto: string;
  nome: string;
  pastas: Pasta[];
  value: ConfigAbertura;
  onChange: (value: ConfigAbertura) => void;
  token: () => Promise<string>;
};

export default function ProjectCinematicSettings({ projeto, nome, pastas, value, onChange, token }: Props) {
  const publicadas = pastas.filter((p) => p.visivel && p.qtd > 0);
  const [pasta, setPasta] = useState(publicadas[0]?.id ?? "");
  const [fotos, setFotos] = useState<Preview[]>([]);
  const [cache, setCache] = useState<Record<string, Preview[]>>({});
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [preview, setPreview] = useState<FotoAberturaPublica[] | null>(null);

  async function buscar(pastaId: string): Promise<Preview[]> {
    const access = await token();
    if (!access) throw new Error("Sessão expirada.");
    const resp = await fetch(`/api/projeto/workspace?projeto=${encodeURIComponent(projeto)}&capaPasta=${encodeURIComponent(pastaId)}`, {
      headers: { Authorization: `Bearer ${access}` },
      cache: "no-store",
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "Não foi possível carregar as fotos.");
    return (data.fotos ?? []) as Preview[];
  }

  useEffect(() => {
    if (!pasta) { setFotos([]); return; }
    let ativo = true;
    setCarregando(true); setAviso("");
    void buscar(pasta).then((lista) => {
      if (ativo) {
        setFotos(lista);
        setCache((prev) => ({ ...prev, [pasta]: lista }));
      }
    }).catch((e: unknown) => {
      if (ativo) setAviso(e instanceof Error ? e.message : "Não foi possível carregar as fotos.");
    }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
    // Apenas recarregar ao trocar a pasta. A função de token obtém a sessão atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasta, projeto]);

  function alternarFoto(foto: FotoAbertura) {
    const selecionada = value.fotos.some((f) => f.pastaId === foto.pastaId && f.arquivo === foto.arquivo);
    if (!selecionada && value.fotos.length >= 3) {
      setAviso("Escolha no máximo três fotografias.");
      return;
    }
    onChange({
      ...value,
      fotos: selecionada
        ? value.fotos.filter((f) => !(f.pastaId === foto.pastaId && f.arquivo === foto.arquivo))
        : [...value.fotos, foto],
    });
    setAviso("");
  }

  async function verPreview() {
    try {
      setAviso("");
      const porPasta: Record<string, Preview[]> = { ...cache };
      for (const pastaId of [...new Set(value.fotos.map((f) => f.pastaId))]) {
        if (!porPasta[pastaId]) porPasta[pastaId] = await buscar(pastaId);
      }
      setCache((anterior) => ({ ...anterior, ...porPasta }));
      const selecionadas = value.fotos.map((foto) => {
        const url = porPasta[foto.pastaId]?.find((f) => f.nome === foto.arquivo)?.url;
        return url ? { ...foto, url } : null;
      }).filter((f): f is FotoAberturaPublica => f !== null);
      if (!selecionadas.length) throw new Error("Selecione fotografias disponíveis para visualizar.");
      setPreview(selecionadas);
    } catch (e) { setAviso(e instanceof Error ? e.message : "Não foi possível abrir a prévia."); }
  }

  return <>
    <div className="pw-config-card fcs-settings">
      <style>{css}</style>
      <span>EXPERIÊNCIA DO CLIENTE</span>
      <h3>Abertura cinematográfica</h3>
      <p className="pw-note">Apresente o projeto com fotos e uma frase antes das galerias. A abertura é opcional e pode ser pulada pelo cliente.</p>

      <label className="fcs-toggle">
        <input type="checkbox" checked={value.ativo} onChange={(e) => {
          setAviso("");
          onChange({ ...value, ativo: e.target.checked });
        }} />
        <span>Ativar abertura para este projeto</span>
      </label>

      <label className="pw-field">Estilo
        <select value={value.estilo} onChange={(e) => onChange({ ...value, estilo: e.target.value as ConfigAbertura["estilo"] })}>
          <option value="cinematografico">Cinematográfico — transições suaves</option>
          <option value="minimalista">Minimalista — uma foto, três mensagens</option>
          <option value="editorial">Editorial — trocas rápidas de fotos</option>
        </select>
      </label>

      <label className="pw-field">Duração
        <select value={value.duracao} onChange={(e) => onChange({ ...value, duracao: Number(e.target.value) as 4 | 6 | 8 })}>
          <option value={4}>4 segundos</option><option value={6}>6 segundos</option><option value={8}>8 segundos</option>
        </select>
      </label>

      <label className="pw-field">Frase inicial
        <textarea maxLength={140} rows={2} value={value.frase}
          onChange={(e) => onChange({ ...value, frase: e.target.value })} placeholder="Alguns momentos merecem ser revividos." />
        <small>{value.frase.length}/140 caracteres</small>
      </label>

      <div className="fcs-photo-head"><strong>Fotografias da abertura</strong><small>{value.fotos.length}/3 selecionadas</small></div>
      {publicadas.length ? <>
        <label className="pw-field">Pasta
          <select value={pasta} onChange={(e) => setPasta(e.target.value)}>
            {publicadas.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          </select>
        </label>
        <div className="fcs-photos" role="group" aria-label="Escolher fotografias da abertura">
          {carregando ? <p>Carregando fotografias…</p> : fotos.length
            ? fotos.slice(0, 90).map((foto) => {
              const marcada = value.fotos.some((f) => f.pastaId === pasta && f.arquivo === foto.nome);
              return <button key={foto.nome} type="button" className={marcada ? "selected" : ""}
                aria-label={`${marcada ? "Remover" : "Escolher"} foto ${foto.nome}`} aria-pressed={marcada}
                onClick={() => alternarFoto({ pastaId: pasta, arquivo: foto.nome })}>
                <img src={foto.url} alt="" loading="lazy" />
                {marcada && <span aria-hidden="true">✓</span>}
              </button>;
            })
            : <p>Adicione fotografias a uma pasta publicada para escolher imagens.</p>}
        </div>
      </> : <p className="pw-note">Publique uma pasta com fotografias antes de ativar a abertura.</p>}
      {value.fotos.length > 0 && <div className="fcs-selected">
        {value.fotos.map((f, i) => <button key={`${f.pastaId}/${f.arquivo}`} type="button" onClick={() => alternarFoto(f)}>
          {i + 1}. {f.arquivo} <span aria-hidden="true">×</span>
        </button>)}
      </div>}
      {aviso && <p role="alert" className="fcs-alert">{aviso}</p>}
      {value.ativo && !value.fotos.length && <p className="fcs-alert">Selecione ao menos uma fotografia para ativar.</p>}
      <button type="button" className="fcs-preview" disabled={!value.fotos.length} onClick={() => void verPreview()}>Visualizar prévia da abertura →</button>
      <p className="pw-note">Para publicar, use o botão “Salvar configurações” abaixo. O cliente poderá pular a introdução; ela não bloqueará o acesso às galerias.</p>
    </div>
    {preview && <ProjectCinematicIntro projetoNome={nome} studioNome={null}
      config={{ ...value, ativo: true, fotos: preview }} onFinish={() => setPreview(null)} preview />}
  </>;
}

const css = `
.fcs-settings{min-width:0}.fcs-toggle{display:flex;align-items:center;gap:12px;cursor:pointer;font-weight:600;font-size:13px;margin:15px 0 22px}
.fcs-toggle input{accent-color:#5550dd;width:18px;height:18px;flex:none}
.fcs-photo-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:22px 0 8px;font-size:13px}.fcs-photo-head small{color:#777}
.fcs-photos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;max-height:330px;overflow:auto;padding:2px}
.fcs-photos button{position:relative;aspect-ratio:1;border:2px solid transparent;border-radius:9px;overflow:hidden;padding:0;background:#efedf3;cursor:pointer}
.fcs-photos button.selected{border-color:#5c4bfc}.fcs-photos button img{width:100%;height:100%;object-fit:cover}
.fcs-photos button span{position:absolute;top:5px;right:5px;display:grid;place-items:center;width:22px;height:22px;border-radius:100px;background:#5341df;color:#fff;font-weight:bold}
.fcs-photos button:focus-visible,.fcs-preview:focus-visible{outline:3px solid #8676f8;outline-offset:2px}
.fcs-photos>p{grid-column:1/-1;font-size:12px;color:#777}
.fcs-selected{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px}
.fcs-selected button{max-width:100%;border:1px solid #ddd6eb;border-radius:999px;padding:6px 10px;background:#f5f3fb;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fcs-selected span{margin-left:6px}.fcs-alert{font-size:12px;color:#a0473e;margin-top:10px}
.fcs-preview{margin:15px 0;border:1px solid #c3c0df;padding:10px 14px;border-radius:11px;color:#332a85;background:#f0edff;font-size:12px;font-weight:700;cursor:pointer}
.fcs-preview:disabled{opacity:.45;cursor:not-allowed}
@media(max-width:600px){.fcs-photos{grid-template-columns:repeat(3,minmax(0,1fr))}}
`;
