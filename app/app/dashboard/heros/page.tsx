"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import MenuFotografo from "../../MenuFotografo";

type Etapa = "prova" | "selecao_finalizada" | "preparando_entrega" | "entrega";
type Galeria = {
  id: string;
  titulo: string;
  capa: string | null;
  heroFundoFoto: boolean;
  etapa: Etapa;
  prova: boolean;
};
type Foto = { nome: string; thumb: string; original: string };
type BillingStatus = {
  plano?: { codigo?: string; nome?: string; recursos?: { heroFotoGaleria?: boolean } };
  status?: string;
};

export default function HerosGaleriaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [podeFotoHero, setPodeFotoHero] = useState(false);
  const [planoNome, setPlanoNome] = useState("Seu plano");
  const [modalId, setModalId] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [carregandoFotos, setCarregandoFotos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/login"); return; }
      const userId = userData.user.id;
      setUid(userId);

      const { data: { session } } = await supabase.auth.getSession();
      let liberaFoto = false;
      let nomePlano = "Sem plano";
      if (session?.access_token) {
        try {
          const r = await fetch("/api/billing/status", {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
          });
          if (r.ok) {
            const b = await r.json() as BillingStatus;
            liberaFoto = Boolean(b.plano?.recursos?.heroFotoGaleria);
            nomePlano = b.plano?.nome || nomePlano;
          }
        } catch {}
      }

      const { data, error } = await supabase
        .from("galerias")
        .select("id,titulo,capa,hero_fundo_foto,etapa,prova")
        .eq("user_id", userId)
        .order("criado_em", { ascending: false });

      if (!ativo) return;
      if (error) {
        setErro(true);
        setMensagem("Não foi possível carregar suas galerias.");
        setCarregando(false);
        return;
      }
      setPodeFotoHero(liberaFoto);
      setPlanoNome(nomePlano);
      setGalerias((data ?? []).map(row => ({
        id: row.id as string,
        titulo: (row.titulo as string) || "Galeria",
        capa: (row.capa as string | null) ?? null,
        heroFundoFoto: Boolean(row.hero_fundo_foto),
        etapa: ((row.etapa as Etapa | null) ?? (row.prova ? "prova" : "entrega")),
        prova: Boolean(row.prova),
      })));
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  async function assinar(caminhos: string[]) {
    const mapa = new Map<string, string>();
    for (let i = 0; i < caminhos.length; i += 200) {
      const { data, error } = await supabase.storage.from("fotos").createSignedUrls(caminhos.slice(i, i + 200), 3600);
      if (error) throw error;
      for (const item of data ?? []) if (item.path && item.signedUrl) mapa.set(item.path as string, item.signedUrl as string);
    }
    return mapa;
  }

  async function abrirGaleria(g: Galeria) {
    setModalId(g.id);
    setFotos([]);
    setMensagem("");
    setErro(false);
    setCarregandoFotos(true);
    try {
      const entregaFinalDeProva = g.etapa === "entrega" && g.prova;
      const base = entregaFinalDeProva ? `${uid}/${g.id}/entrega` : `${uid}/${g.id}`;
      const nomes: string[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase.storage.from("fotos").list(base, {
          limit: 1000,
          offset,
          sortBy: { column: "created_at", order: "asc" },
        });
        if (error) throw error;
        const pagina = data ?? [];
        nomes.push(...pagina.filter(f => f.id !== null && f.name !== "thumbs").map(f => f.name));
        if (pagina.length < 1000) break;
        offset += 1000;
      }
      const caminhos = nomes.flatMap(nome => [`${base}/thumbs/${nome}`, `${base}/${nome}`]);
      const mapa = caminhos.length ? await assinar(caminhos) : new Map<string, string>();
      setFotos(nomes.map(nome => ({
        nome,
        thumb: mapa.get(`${base}/thumbs/${nome}`) ?? "",
        original: mapa.get(`${base}/${nome}`) ?? "",
      })));
    } catch {
      setErro(true);
      setMensagem("Não foi possível carregar as fotos desta galeria.");
    } finally {
      setCarregandoFotos(false);
    }
  }

  async function escolherFoto(g: Galeria, foto: Foto) {
    if (salvando) return;
    setSalvando(true);
    setMensagem("");
    setErro(false);
    const { data, error } = await supabase.rpc("definir_capa_galeria", { p_galeria: g.id, p_arquivo: foto.nome });
    setSalvando(false);
    if (error || data !== true) {
      setErro(true);
      setMensagem("Não foi possível definir essa foto como capa.");
      return;
    }
    setGalerias(prev => prev.map(item => item.id === g.id ? { ...item, capa: foto.nome } : item));
    setMensagem(g.heroFundoFoto ? "Foto atualizada. Ela já está sendo usada no fundo do hero." : "Foto escolhida. Agora você pode ativá-la como fundo do hero.");
  }

  async function alternarFundo(g: Galeria) {
    if (salvando) return;
    if (!podeFotoHero) {
      setErro(true);
      setMensagem("Fundo do hero com foto está disponível nos planos Profissional e Studio.");
      return;
    }
    if (!g.capa && !g.heroFundoFoto) {
      setErro(true);
      setMensagem("Escolha uma foto antes de ativar o fundo do hero.");
      return;
    }
    setSalvando(true);
    setMensagem("");
    setErro(false);
    const novoValor = !g.heroFundoFoto;
    const { data, error } = await supabase.rpc("definir_fundo_foto_hero", { p_galeria: g.id, p_ativo: novoValor });
    setSalvando(false);
    if (error || data !== true) {
      setErro(true);
      setMensagem(novoValor ? "Seu plano não permite ativar foto no fundo do hero." : "Não foi possível desativar o fundo com foto.");
      return;
    }
    setGalerias(prev => prev.map(item => item.id === g.id ? { ...item, heroFundoFoto: novoValor } : item));
    setMensagem(novoValor ? "Foto ativada no fundo do hero." : "Fundo com foto desativado.");
  }

  const modal = galerias.find(g => g.id === modalId) ?? null;

  if (carregando) return <div className="hero-loading">Carregando personalização…<style>{`.hero-loading{min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#090917,#0e0e20);color:#7a7f9a}`}</style></div>;

  return <main className="hero-page mf-shift"><MenuFotografo/><style>{`
    .hero-page{min-height:100vh;background:linear-gradient(180deg,#090917,#0e0e20);color:#f0f0f5}.body{max-width:1040px;margin:auto;padding:46px 40px 80px}.top{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}.ey{font-size:11px;letter-spacing:2px;color:#6f76a0}.h1{font-size:30px;margin:7px 0}.sub{font-size:13px;color:#7a7f9a;line-height:1.55}.back,.btn{border:1px solid #2a2d40;border-radius:10px;background:#111124;color:#cfd5ea;padding:10px 13px;font:600 12px inherit;cursor:pointer}.btn.primary{border:0;color:#fff;background:linear-gradient(90deg,#1196fc,#5d0dfa)}.upgrade{margin-top:22px;padding:15px 17px;border:1px solid rgba(93,13,250,.32);border-radius:14px;background:linear-gradient(135deg,rgba(17,150,252,.07),rgba(93,13,250,.07));display:flex;justify-content:space-between;align-items:center;gap:16px}.upgrade strong{font-size:13px}.upgrade p{font-size:11px;color:#858ba8;margin:4px 0 0}.notice{margin-top:16px;padding:11px 13px;border-radius:10px;font-size:12px;color:#8fe3b0;background:rgba(143,227,176,.06);border:1px solid rgba(143,227,176,.18)}.notice.err{color:#ff9d9d;background:rgba(255,157,157,.06);border-color:rgba(255,157,157,.18)}.list{display:grid;gap:10px;margin-top:22px}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:16px 17px;border:1px solid #23263e;border-radius:14px;background:linear-gradient(180deg,#14142b,#101023)}.name{font-size:14px;font-weight:650}.meta{font-size:11px;color:#747a96;margin-top:5px}.badge{display:inline-flex;margin-left:8px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:750;border:1px solid rgba(143,227,176,.28);color:#9fe8bc;background:rgba(143,227,176,.06)}.badge.off{color:#8c91a8;border-color:#2b2e47;background:#111124}.actions{display:flex;gap:8px;align-items:center}.empty{margin-top:22px;padding:40px;text-align:center;color:#747a96;border:1px solid #23263e;border-radius:14px;background:#111124}.modal{position:fixed;inset:0;z-index:130;background:rgba(3,3,12,.82);display:flex;align-items:center;justify-content:center;padding:18px}.panel{width:min(900px,100%);max-height:90vh;overflow:auto;padding:22px;border:1px solid #292c47;border-radius:17px;background:linear-gradient(180deg,#14142b,#101023)}.mhead{display:flex;justify-content:space-between;gap:15px;align-items:flex-start}.close{width:38px;height:38px;border:1px solid #2a2d40;border-radius:10px;background:#111124;color:#cfd5ea;font-size:19px}.hero-option{margin-top:18px;padding:14px;border:1px solid #292d47;border-radius:13px;background:#0e0f1d;display:flex;align-items:center;justify-content:space-between;gap:16px}.hero-option strong{font-size:13px}.hero-option p{font-size:11px;color:#747b97;margin:4px 0 0}.hero-option.locked{border-color:rgba(246,196,69,.24)}.photos{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:18px}.photo{position:relative;aspect-ratio:1;border:2px solid transparent;border-radius:11px;overflow:hidden;padding:0;background:#0c0c19;cursor:pointer}.photo img{width:100%;height:100%;object-fit:cover}.photo.on{border-color:#5d6dfa}.photo.on:after{content:'CAPA';position:absolute;left:7px;bottom:7px;padding:3px 6px;border-radius:999px;background:rgba(8,9,20,.82);color:#fff;font-size:8px;font-weight:800;letter-spacing:.5px}.loading{text-align:center;padding:40px;color:#737992}@media(max-width:760px){.body{padding:76px 14px 60px}.top{align-items:flex-start;flex-direction:column}.upgrade,.hero-option{align-items:flex-start;flex-direction:column}.row{grid-template-columns:1fr}.actions{justify-content:flex-start;flex-wrap:wrap}.photos{grid-template-columns:repeat(3,minmax(0,1fr))}.panel{padding:17px}.h1{font-size:25px}}`}</style>
    <div className="body"><header className="top"><div><div className="ey">HEROS DAS GALERIAS</div><h1 className="h1">Fundo fotográfico por entrega</h1><p className="sub">Escolha uma foto da própria galeria e use-a como fundo. Com Premium ou Tech ativos, a composição de logo e textos continua seguindo o preset do estúdio.</p></div><button className="back" onClick={()=>router.push("/perfil")}>← Perfil</button></header>
      {!podeFotoHero&&<div className="upgrade"><div><strong>Recurso Profissional</strong><p>{planoNome} mantém os heros básicos. Fundo com foto está disponível no Profissional e Studio.</p></div><button className="btn primary" onClick={()=>router.push("/dashboard/assinatura")}>Ver planos</button></div>}
      {mensagem&&<div role={erro?"alert":"status"} className={"notice"+(erro?" err":"")}>{mensagem}</div>}
      {galerias.length===0?<div className="empty">Crie uma galeria para personalizar o hero.</div>:<div className="list">{galerias.map(g=><article className="row" key={g.id}><div><div className="name">{g.titulo}<span className={"badge"+(g.heroFundoFoto?"":" off")}>{g.heroFundoFoto?"FOTO NO HERO":"FUNDO PADRÃO"}</span></div><div className="meta">{g.capa?`Capa selecionada: ${g.capa}`:"Nenhuma foto escolhida para capa"}</div></div><div className="actions"><button className="btn" onClick={()=>void abrirGaleria(g)}>Escolher foto</button><button className={"btn"+(g.heroFundoFoto?"":" primary")} disabled={salvando||(!podeFotoHero&&!g.heroFundoFoto)} onClick={()=>void alternarFundo(g)}>{g.heroFundoFoto?"Desativar fundo":"Usar no hero"}</button></div></article>)}</div>}
    </div>
    {modal&&<div className="modal" onMouseDown={e=>{if(e.target===e.currentTarget&&!salvando)setModalId(null)}}><section className="panel" role="dialog" aria-modal="true" aria-label={`Hero de ${modal.titulo}`}><div className="mhead"><div><h2 style={{margin:0,fontSize:18}}>{modal.titulo}</h2><p className="sub">Escolha a foto que será usada como capa e, se seu plano permitir, como fundo do hero.</p></div><button className="close" onClick={()=>setModalId(null)} aria-label="Fechar">×</button></div><div className={"hero-option"+(!podeFotoHero?" locked":"")}><div><strong>Usar capa como fundo do hero</strong><p>{podeFotoHero?"Premium e Tech mantêm sua composição por cima da fotografia.":"Disponível a partir do plano Profissional."}</p></div>{podeFotoHero?<button className={"btn"+(modal.heroFundoFoto?"":" primary")} disabled={salvando} onClick={()=>void alternarFundo(modal)}>{modal.heroFundoFoto?"Desativar":"Ativar fundo"}</button>:<button className="btn" onClick={()=>router.push("/dashboard/assinatura")}>Fazer upgrade</button>}</div>{carregandoFotos?<div className="loading">Carregando fotos…</div>:fotos.length===0?<div className="loading">Esta galeria ainda não tem fotos disponíveis.</div>:<div className="photos">{fotos.map(f=><button className={"photo"+(modal.capa===f.nome?" on":"")} disabled={salvando} key={f.nome} onClick={()=>void escolherFoto(modal,f)}>{(f.thumb||f.original)&&<img src={f.thumb||f.original} alt="" onError={e=>{if(f.original)e.currentTarget.src=f.original}}/>}</button>)}</div>}</section></div>}
  </main>;
}
