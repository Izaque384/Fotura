"use client";

import { useEffect, useState } from "react";
import type { ConfigAbertura, FotoAbertura, FotoAberturaPublica } from "../../lib/cinematic-intro";
import ProjectCinematicIntro from "../components/ProjectCinematicIntro";
import { createClient } from "../../lib/supabase-client";
import { VIDEO_ABERTURA_BUCKET, VIDEO_ABERTURA_MAX_BYTES } from "../../lib/cinematic-intro";

type Pasta = { id: string; titulo: string; visivel: boolean; qtd: number };
type Preview = { nome: string; url: string };
type Props = {
  projeto: string;
  nome: string;
  descricao: string;
  pastas: Pasta[];
  value: ConfigAbertura;
  onChange: (value: ConfigAbertura) => void;
  token: () => Promise<string>;
};

export default function ProjectCinematicSettings({ projeto, nome, descricao, pastas, value, onChange, token }: Props) {
  const publicadas = pastas.filter((p) => p.visivel && p.qtd > 0);
  const idsPublicadas = publicadas.map((p) => p.id).join("|");
  const [pasta, setPasta] = useState(publicadas[0]?.id ?? "");
  const [fotos, setFotos] = useState<Preview[]>([]);
  const [cache, setCache] = useState<Record<string, Preview[]>>({});
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [preview, setPreview] = useState<{ fotos: FotoAberturaPublica[]; videoUrl: string | null } | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [enviandoVideo, setEnviandoVideo] = useState(false);
  const [preparandoPreview, setPreparandoPreview] = useState(false);
  // As pastas chegam após o carregamento do projeto. Atualize a seleção inicial.
  useEffect(() => {
    setPasta((anterior) => idsPublicadas.split("|").includes(anterior) ? anterior : publicadas[0]?.id ?? "");
    // A lista de ids é a chave estável desta dependência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsPublicadas]);

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

  useEffect(() => {
    if (!value.video) { setVideoPreviewUrl(null); return; }
    let ativo = true;
    async function buscarVideo() {
      const access = await token();
      if (!access) return;
      const resp = await fetch(`/api/projeto/video?projeto=${encodeURIComponent(projeto)}&path=${encodeURIComponent(value.video!)}`, {
        headers: { Authorization: `Bearer ${access}` }, cache: "no-store",
      });
      const data = await resp.json().catch(() => ({}));
      if (ativo) setVideoPreviewUrl(resp.ok ? data.url ?? null : null);
    }
    void buscarVideo();
    return () => { ativo = false; };
    // Só muda quando o MP4 selecionado é trocado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.video, projeto]);

  async function validarDuracao(file: File): Promise<void> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const duracao = await new Promise<number>((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => resolve(video.duration);
        video.onerror = () => reject(new Error("Não foi possível ler o MP4. Exporte em H.264."));
        video.src = objectUrl;
      });
      if (!Number.isFinite(duracao) || duracao < 10 || duracao > 30)
        throw new Error("Escolha um vídeo de 10 a 30 segundos.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function enviarVideo(file: File | undefined) {
    if (!file || enviandoVideo) return;
    setAviso("");
    if (file.size <= 0 || file.size > VIDEO_ABERTURA_MAX_BYTES ||
      (!file.name.toLowerCase().endsWith(".mp4")) ||
      (file.type && file.type !== "video/mp4")) {
      setAviso("Escolha um MP4 (H.264) de até 25 MB."); return;
    }
    setEnviandoVideo(true);
    let criado: string | null = null;
    try {
      await validarDuracao(file);
      const access = await token();
      if (!access) throw new Error("Sua sessão expirou.");
      const preparar = await fetch("/api/projeto/video", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ projeto, acao: "preparar", bytes: file.size }),
      });
      const dados = await preparar.json().catch(() => ({}));
      if (!preparar.ok) throw new Error(dados.error || "Não foi possível preparar o vídeo.");
      criado = dados.path;
      const storage = createClient().storage.from(VIDEO_ABERTURA_BUCKET);
      const { error: erroUpload } = await storage.uploadToSignedUrl(dados.path, dados.token, file, {
        contentType: "video/mp4", cacheControl: "3600",
      });
      if (erroUpload) throw new Error("Falha no envio do vídeo. Tente novamente.");
      const confirmar = await fetch("/api/projeto/video", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        body: JSON.stringify({ projeto, acao: "confirmar", path: dados.path }),
      });
      const pronto = await confirmar.json().catch(() => ({}));
      if (!confirmar.ok) throw new Error(pronto.error || "Não foi possível confirmar o vídeo.");
      const anterior = value.video;
      setVideoPreviewUrl(pronto.url ?? null);
      onChange({ ...value, fundo: "video", video: pronto.path });
      // A versão anterior só pode ser removida aqui se ainda não tiver sido publicada.
      if (anterior && anterior !== pronto.path)
        void fetch("/api/projeto/video", {
          method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
          body: JSON.stringify({ projeto, path: anterior }),
        }).catch(() => {});
      setAviso("Vídeo pronto. Clique em Salvar configurações para publicar.");
      criado = null;
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível enviar o vídeo.");
    } finally {
      if (criado) {
        const access = await token();
        if (access) void fetch("/api/projeto/video", {
          method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
          body: JSON.stringify({ projeto, path: criado }),
        }).catch(() => {});
      }
      setEnviandoVideo(false);
    }
  }

  function removerVideo() {
    onChange({ ...value, fundo: "fotos", video: null });
    setVideoPreviewUrl(null);
    setAviso("Vídeo removido da edição. Salve as configurações para confirmar.");
  }

  async function verPreview() {
    if (preparandoPreview) return;
    setPreparandoPreview(true);
    try {
      setAviso("");
      // URLs assinadas expiram. Recarregar as imagens sempre antes da prévia
      // evita fotos quebradas depois de alguns minutos editando o projeto.
      const porPasta: Record<string, Preview[]> = {};
      for (const pastaId of [...new Set(value.fotos.map((f) => f.pastaId))]) {
        porPasta[pastaId] = await buscar(pastaId);
      }
      setCache((anterior) => ({ ...anterior, ...porPasta }));
      const selecionadas = value.fotos.map((foto) => {
        const url = porPasta[foto.pastaId]?.find((f) => f.nome === foto.arquivo)?.url;
        return url ? { ...foto, url } : null;
      }).filter((f): f is FotoAberturaPublica => f !== null);
      if (!selecionadas.length || selecionadas.length !== value.fotos.length)
        throw new Error("Alguma foto não está mais disponível. Revise a seleção da abertura.");
      let videoUrl: string | null = null;
      if (value.fundo === "video" && value.video) {
        const access = await token();
        if (access) {
          const resposta = await fetch(`/api/projeto/video?projeto=${encodeURIComponent(projeto)}&path=${encodeURIComponent(value.video)}`, {
            headers: { Authorization: `Bearer ${access}` }, cache: "no-store",
          });
          const json = await resposta.json().catch(() => ({}));
          if (resposta.ok) videoUrl = json.url ?? null;
        }
      }
      setPreview({ fotos: selecionadas, videoUrl });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível abrir a prévia.");
    } finally {
      setPreparandoPreview(false);
    }
  }

  return <>
    <div className="pw-config-card fcs-settings">
      <style>{css}</style>
      <span>EXPERIÊNCIA DO CLIENTE</span>
      <h3>Abertura cinematográfica</h3>
      <p className="pw-note">Escolha fotografias ou um único vídeo silencioso como fundo das três cenas. O cliente pode avançar, voltar ou pular a abertura.</p>

      <label className="fcs-toggle">
        <input type="checkbox" checked={value.ativo} onChange={(e) => {
          setAviso("");
          onChange({ ...value, ativo: e.target.checked });
        }} />
        <span>Ativar abertura para este projeto</span>
      </label>

      <div className="fcs-photo-head"><strong>Fundo da abertura</strong></div>
      <div className="fcs-modes" role="group" aria-label="Tipo de fundo">
        <label><input type="radio" name="fundo-abertura" checked={value.fundo !== "video"}
          onChange={() => onChange({ ...value, fundo: "fotos" })} /> Fotografias</label>
        <label><input type="radio" name="fundo-abertura" checked={value.fundo === "video"}
          onChange={() => onChange({ ...value, fundo: "video" })} /> Vídeo cinematográfico</label>
      </div>
      <div className="fcs-video-control">
        <strong>Vídeo de abertura (opcional)</strong>
        <p className="pw-note">Um MP4 (H.264), de 10 a 30 segundos e até 25 MB. Reproduz sem áudio, em tela cheia, com repetição. Em conexões lentas ou com movimento reduzido, mostramos as fotografias.</p>
        <label className="fcs-video-upload">
          {enviandoVideo ? "Enviando vídeo…" : value.video ? "Substituir vídeo MP4" : "Selecionar vídeo MP4"}
          <input type="file" accept="video/mp4,.mp4" disabled={enviandoVideo}
            onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; void enviarVideo(file); }} />
        </label>
        {value.video && <div className="fcs-video-status">
          <span>✓ Vídeo selecionado {videoPreviewUrl ? "· prévia disponível" : ""}</span>
          <button type="button" onClick={removerVideo} disabled={enviandoVideo}>Remover vídeo</button>
        </div>}
      </div>

      <label className="pw-field">Estilo
        <select value={value.estilo} onChange={(e) => onChange({ ...value, estilo: e.target.value as ConfigAbertura["estilo"] })}>
          <option value="cinematografico">Cinematográfico — transições suaves</option>
          <option value="minimalista">Minimalista — uma foto, três mensagens</option>
          <option value="editorial">Editorial — trocas rápidas de fotos</option>
        </select>
      </label>

      <label className="pw-field">Duração
        <select value={value.duracao} onChange={(e) => onChange({ ...value, duracao: Number(e.target.value) as 15 | 21 | 30 })}>
          <option value={15}>15 segundos · tranquilo</option><option value={21}>21 segundos · recomendado</option><option value={30}>30 segundos · contemplativo</option>
        </select>
        <small>De 5 a 10 segundos por cena, com transições suaves. O cliente pode voltar ou avançar a qualquer momento.</small>
      </label>

      <label className="pw-field">Frase inicial
        <textarea maxLength={140} rows={2} value={value.frase}
          onChange={(e) => onChange({ ...value, frase: e.target.value })} placeholder="Alguns momentos merecem ser revividos." />
        <small>{value.frase.length}/140 caracteres</small>
      </label>

      <div className="fcs-photo-head"><strong>{value.fundo === "video" ? "Fotografias de reserva" : "Fotografias da abertura"}</strong><small>{value.fotos.length}/3 selecionadas</small></div>
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
      {aviso && <p role="status" className="fcs-alert">{aviso}</p>}
      {value.ativo && value.fundo === "video" && !value.video && <p className="fcs-alert">Envie um vídeo antes de publicar neste modo.</p>}
      {value.ativo && !value.fotos.length && <p className="fcs-alert">Selecione ao menos uma fotografia para garantir a abertura quando o vídeo não puder tocar.</p>}
      <button type="button" className="fcs-preview" disabled={!value.fotos.length || preparandoPreview} onClick={() => void verPreview()}>{preparandoPreview ? "Preparando prévia…" : "Visualizar prévia da abertura →"}</button>
      <p className="pw-note">Para publicar, use o botão “Salvar configurações” abaixo. A abertura aparece em cada novo acesso ao link principal; o cliente pode voltar, avançar ou pular.</p>
    </div>
    {preview && <ProjectCinematicIntro projetoNome={nome} projetoDescricao={descricao} studioNome={null}
      config={{ ...value, ativo: true, fotos: preview.fotos, videoUrl: preview.videoUrl }} onFinish={() => setPreview(null)} preview />}
  </>;
}

const css = `
.fcs-settings{min-width:0}
.fcs-modes{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 16px}
.fcs-modes label{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #ddd9e7;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer}
.fcs-modes input{accent-color:#5550dd}
.fcs-video-control{border:1px solid #e2ddea;border-radius:12px;padding:14px;margin-bottom:18px}
.fcs-video-control>strong{font-size:13px}
.fcs-video-upload{display:inline-flex;align-items:center;justify-content:center;margin-top:6px;background:#f0edff;color:#332a85;border:1px solid #c3c0df;border-radius:9px;padding:10px 12px;font-weight:700;font-size:12px;cursor:pointer}
.fcs-video-upload input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}
.fcs-video-upload:focus-within{outline:2px solid #8676f8}
.fcs-video-status{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:12px;font-size:12px}
.fcs-video-status button{border:1px solid #ddd6eb;background:#fff;border-radius:8px;padding:7px 10px;cursor:pointer}.fcs-toggle{display:flex;align-items:center;gap:12px;cursor:pointer;font-weight:600;font-size:13px;margin:15px 0 22px}
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
