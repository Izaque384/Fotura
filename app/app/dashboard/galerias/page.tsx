"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import MenuFotografo from "../../MenuFotografo";
import ModalSelecao from "../../components/ModalSelecao";

type Config = { prova: boolean; limite: number; prazo: string | null; linkAte: string | null; temSenha: boolean };
type Selecao = { fotos: string[]; finalizada: boolean; comentarios: Record<string, string>; atualizadoEm?: string };
type Galeria = {
  id: string;
  titulo: string;
  criadoEm: string | null;
  capa: string | null;
  arquivos: string[];
  qtd: number;
  thumbUrl?: string;
  originalUrl?: string;
  config: Config;
};
type Ordem = "data" | "nome" | "estado";

type FotoModal = { nome: string; thumb: string; original: string };

export default function GaleriasPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [carregando, setCarregando] = useState(true);
  const [uid, setUid] = useState("");
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [selecoes, setSelecoes] = useState<Record<string, Selecao>>({});
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("data");
  const [aviso, setAviso] = useState("");
  const [configModal, setConfigModal] = useState<string | null>(null);
  const [fProva, setFProva] = useState(false);
  const [fLimite, setFLimite] = useState("");
  const [fPrazo, setFPrazo] = useState("");
  const [fLink, setFLink] = useState("");
  const [fSenha, setFSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [capaModal, setCapaModal] = useState<string | null>(null);
  const [fotosCapa, setFotosCapa] = useState<FotoModal[]>([]);
  const [carregandoCapa, setCarregandoCapa] = useState(false);
  const [selecaoModal, setSelecaoModal] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      const meuId = auth.user.id;
      setUid(meuId);

      const { data: rows, error } = await supabase
        .from("galerias")
        .select("id,titulo,criado_em,capa,prova,limite,prazo,link_ate,tem_senha")
        .eq("user_id", meuId)
        .order("criado_em", { ascending: false });

      if (!ativo) return;
      if (error) {
        setAviso("Não foi possível carregar suas galerias agora.");
        setCarregando(false);
        return;
      }

      const bases = rows ?? [];
      const listagens = await Promise.all(bases.map(async (row) => {
        const { data } = await supabase.storage.from("fotos").list(`${meuId}/${row.id}`, { limit: 500, sortBy: { column: "created_at", order: "asc" } });
        const arquivos = (data ?? []).filter((f) => f.id !== null).map((f) => f.name);
        return { id: row.id as string, arquivos };
      }));
      if (!ativo) return;

      const porId = new Map(listagens.map((x) => [x.id, x.arquivos]));
      const capasEscolhidas = bases.map((row) => {
        const arquivos = porId.get(row.id as string) ?? [];
        const nome = (row.capa as string | null) && arquivos.includes(row.capa as string) ? row.capa as string : arquivos[0];
        return nome ? { id: row.id as string, nome } : null;
      }).filter(Boolean) as { id: string; nome: string }[];

      const caminhosCapas = capasEscolhidas.flatMap((c) => [
        `${meuId}/${c.id}/thumbs/${c.nome}`,
        `${meuId}/${c.id}/${c.nome}`,
      ]);
      const { data: urls } = caminhosCapas.length ? await supabase.storage.from("fotos").createSignedUrls(caminhosCapas, 3600) : { data: [] };
      const mapaUrl = new Map((urls ?? []).filter((u) => u.path && u.signedUrl).map((u) => [u.path as string, u.signedUrl as string]));

      const lista: Galeria[] = bases.map((row) => {
        const id = row.id as string;
        const arquivos = porId.get(id) ?? [];
        const nomeCapa = (row.capa as string | null) && arquivos.includes(row.capa as string) ? row.capa as string : arquivos[0] ?? null;
        return {
          id,
          titulo: (row.titulo as string) || "Galeria",
          criadoEm: (row.criado_em as string | null) ?? null,
          capa: (row.capa as string | null) ?? null,
          arquivos,
          qtd: arquivos.length,
          thumbUrl: nomeCapa ? mapaUrl.get(`${meuId}/${id}/thumbs/${nomeCapa}`) : undefined,
          originalUrl: nomeCapa ? mapaUrl.get(`${meuId}/${id}/${nomeCapa}`) : undefined,
          config: {
            prova: Boolean(row.prova),
            limite: (row.limite as number) ?? 0,
            prazo: (row.prazo as string | null) ?? null,
            linkAte: (row.link_ate as string | null) ?? null,
            temSenha: Boolean(row.tem_senha),
          },
        };
      });

      const ids = lista.map((g) => g.id);
      const mapaSel: Record<string, Selecao> = {};
      if (ids.length) {
        const { data: sels } = await supabase.from("selecoes").select("galeria,fotos,finalizada,comentarios,atualizado_em").in("galeria", ids);
        for (const s of sels ?? []) mapaSel[s.galeria] = { fotos: (s.fotos as string[]) ?? [], finalizada: Boolean(s.finalizada), comentarios: (s.comentarios as Record<string,string>) ?? {}, atualizadoEm: (s.atualizado_em as string) ?? undefined };
      }
      if (!ativo) return;
      setSelecoes(mapaSel);
      setGalerias(lista);
      setCarregando(false);
    }
    carregar();
    return () => { ativo = false; };
  }, [router, supabase]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const lista = galerias.filter((g) => !termo || g.titulo.toLocaleLowerCase("pt-BR").includes(termo));
    return lista.sort((a,b) => {
      if (ordem === "nome") return a.titulo.localeCompare(b.titulo, "pt-BR");
      if (ordem === "estado") {
        const estado = (g: Galeria) => selecoes[g.id]?.finalizada ? 2 : selecoes[g.id] ? 1 : 0;
        return estado(b) - estado(a) || (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "");
      }
      return (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "");
    });
  }, [busca, galerias, ordem, selecoes]);

  function dataCurta(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  }

  function estado(g: Galeria) {
    const s = selecoes[g.id];
    if (s?.finalizada) return { texto: "Seleção finalizada", cls: "fin" };
    if (s) return { texto: "Seleção em andamento", cls: "and" };
    return { texto: g.config.prova ? "Aguardando cliente" : "Entrega", cls: "neu" };
  }

  async function copiarLink(id: string) {
    const link = `${window.location.origin}/g/${id}`;
    try { await navigator.clipboard.writeText(link); setAviso("Link da galeria copiado."); }
    catch { setAviso("Não foi possível copiar automaticamente. Abra a galeria e copie o endereço."); }
  }

  function abrirConfig(g: Galeria) {
    setFProva(g.config.prova);
    setFLimite(g.config.limite ? String(g.config.limite) : "");
    setFPrazo(g.config.prazo ?? "");
    setFLink(g.config.linkAte ?? "");
    setFSenha("");
    setConfigModal(g.id);
  }

  async function salvarConfig() {
    if (!configModal || salvando) return;
    const g = galerias.find((x) => x.id === configModal);
    if (!g) return;
    setSalvando(true);
    let temSenha = g.config.temSenha;
    const senha = fSenha.trim();
    if (senha) {
      const { error } = await supabase.from("senhas").upsert({ galeria: g.id, senha, atualizado_em: new Date().toISOString() });
      if (error) { setAviso("Não foi possível salvar a senha."); setSalvando(false); return; }
      temSenha = true;
    }
    const limite = Math.max(0, parseInt(fLimite || "0", 10) || 0);
    const novo: Config = { prova: fProva, limite, prazo: fPrazo || null, linkAte: fLink || null, temSenha };
    const { error } = await supabase.from("galerias").update({ prova: novo.prova, limite: novo.limite, prazo: novo.prazo, link_ate: novo.linkAte, tem_senha: novo.temSenha }).eq("id", g.id).eq("user_id", uid);
    setSalvando(false);
    if (error) { setAviso("Não foi possível salvar as configurações."); return; }
    setGalerias((prev) => prev.map((x) => x.id === g.id ? { ...x, config: novo } : x));
    setConfigModal(null);
    setAviso("Configurações salvas.");
  }

  async function removerSenha() {
    if (!configModal) return;
    await supabase.from("senhas").delete().eq("galeria", configModal);
    const { error } = await supabase.from("galerias").update({ tem_senha: false }).eq("id", configModal).eq("user_id", uid);
    if (error) { setAviso("Não foi possível remover a senha."); return; }
    setGalerias((prev) => prev.map((g) => g.id === configModal ? { ...g, config: { ...g.config, temSenha:false } } : g));
    setFSenha("");
    setAviso("Senha removida.");
  }

  async function abrirCapa(g: Galeria) {
    setCapaModal(g.id);
    setCarregandoCapa(true);
    setFotosCapa([]);
    const caminhos = g.arquivos.flatMap((nome) => [`${uid}/${g.id}/thumbs/${nome}`, `${uid}/${g.id}/${nome}`]);
    const { data } = caminhos.length ? await supabase.storage.from("fotos").createSignedUrls(caminhos, 3600) : { data: [] };
    const mapa = new Map((data ?? []).filter((u) => u.path && u.signedUrl).map((u) => [u.path as string, u.signedUrl as string]));
    setFotosCapa(g.arquivos.map((nome) => ({ nome, thumb: mapa.get(`${uid}/${g.id}/thumbs/${nome}`) ?? "", original: mapa.get(`${uid}/${g.id}/${nome}`) ?? "" })));
    setCarregandoCapa(false);
  }

  async function definirCapa(gid: string, foto: FotoModal) {
    const { error } = await supabase.from("galerias").update({ capa: foto.nome }).eq("id", gid).eq("user_id", uid);
    if (error) { setAviso("Não foi possível atualizar a capa."); return; }
    setGalerias((prev) => prev.map((g) => g.id === gid ? { ...g, capa: foto.nome, thumbUrl: foto.thumb, originalUrl: foto.original } : g));
    setCapaModal(null);
    setAviso("Capa atualizada.");
  }

  async function excluir(g: Galeria) {
    if (!window.confirm(`Excluir a galeria “${g.titulo}” e todas as ${g.qtd} foto${g.qtd === 1 ? "" : "s"}? Esta ação não pode ser desfeita.`)) return;
    const caminhos = g.arquivos.flatMap((nome) => [`${uid}/${g.id}/${nome}`, `${uid}/${g.id}/thumbs/${nome}`]);
    if (caminhos.length) {
      const { error } = await supabase.storage.from("fotos").remove(caminhos);
      if (error) { setAviso("Não foi possível excluir todos os arquivos da galeria."); return; }
    }
    await supabase.from("selecoes").delete().eq("galeria", g.id);
    await supabase.from("senhas").delete().eq("galeria", g.id);
    const { error } = await supabase.from("galerias").delete().eq("id", g.id).eq("user_id", uid);
    if (error) { setAviso("Não foi possível excluir a galeria."); return; }
    setGalerias((prev) => prev.filter((x) => x.id !== g.id));
    setAviso("Galeria excluída.");
  }

  const modalCfg = configModal ? galerias.find((g) => g.id === configModal) : null;
  const modalCapaGaleria = capaModal ? galerias.find((g) => g.id === capaModal) : null;
  const modalSelGaleria = selecaoModal ? galerias.find((g) => g.id === selecaoModal) : null;

  return (
    <div className="dash mf-shift">
      <MenuFotografo />
      <style>{`
        .dash { min-height:100vh; background:linear-gradient(180deg,#0b0b1a 0%,#101024 100%); color:#f0f0f5; }
        .dash-body { max-width:1120px; margin:0 auto; padding:40px 40px 80px; }
        .dash-top { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:26px; }
        .dash-eyebrow { font-size:12px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:#6f76a0; margin-bottom:8px; }
        .dash-h1 { font-size:30px; font-weight:700; letter-spacing:-.5px; color:#f5f6fb; margin:0; }
        .dash-sub { font-size:13px; color:#7a7f9a; margin-top:6px; }
        .dash-btn { padding:11px 18px; font-size:14px; font-weight:600; border-radius:11px; cursor:pointer; color:#fff; border:none; font-family:inherit; background:linear-gradient(90deg,#1196fc,#5d0dfa); box-shadow:0 8px 24px rgba(74,108,247,.30); }
        .dash-btn:focus-visible,.tool:focus-visible,.act:focus-visible,.cfg-btn:focus-visible,.cap-item:focus-visible { outline:2px solid #7ea2ff; outline-offset:2px; }
        .dash-aviso { font-size:13px; color:#8fe3b0; background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.25); border-radius:10px; padding:10px 14px; margin-bottom:18px; }
        .card { background:linear-gradient(180deg,#14142b 0%,#101023 100%); border:1px solid #23233c; border-radius:16px; padding:20px; }
        .toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:16px; }
        .pl-input { min-width:250px; flex:1; max-width:440px; padding:11px 13px; border:1px solid #2a2d40; border-radius:10px; background:#0f0f1a; color:#f0f0f5; font:13px inherit; outline:none; }
        .pl-input:focus { border-color:#4a6cf7; }
        .ord { display:inline-flex; padding:3px; border:1px solid #272a42; border-radius:10px; background:rgba(255,255,255,.02); }
        .tool { padding:7px 10px; border:0; border-radius:8px; background:none; color:#7f859d; font:600 12px inherit; cursor:pointer; }
        .tool.on { color:#dfe3f5; background:rgba(74,108,247,.16); }
        .glist { display:flex; flex-direction:column; gap:10px; }
        .grow { display:grid; grid-template-columns:76px minmax(160px,1.4fr) minmax(170px,.9fr) auto; gap:16px; align-items:center; border:1px solid #23233c; border-radius:13px; padding:12px 14px; background:#141428; }
        .gthumb { width:76px; height:58px; border-radius:9px; overflow:hidden; background:#0c0c19; border:1px solid #24263d; }
        .gthumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .gname { color:#f0f0f5; font-size:14px; font-weight:600; }
        .gmeta { color:#747a96; font-size:11px; margin-top:5px; }
        .gstatus { display:flex; flex-direction:column; gap:5px; align-items:flex-start; }
        .badge { display:inline-flex; padding:4px 8px; border-radius:999px; font-size:10px; font-weight:700; }
        .badge.fin { color:#8fe3b0; background:rgba(34,197,94,.12); }
        .badge.and { color:#f6c445; background:rgba(246,196,69,.11); }
        .badge.neu { color:#9fb0ff; background:rgba(74,108,247,.12); }
        .gexp { color:#646a86; font-size:10px; }
        .gacoes { display:flex; justify-content:flex-end; gap:6px; flex-wrap:wrap; }
        .act { padding:8px 10px; border-radius:9px; border:1px solid #2a2d40; background:rgba(255,255,255,.025); color:#c5c9dc; font:600 11px inherit; cursor:pointer; }
        .act:hover { border-color:#4a6cf7; color:#fff; }
        .act.danger:hover { border-color:rgba(239,68,68,.5); color:#ff9d9d; }
        .empty { text-align:center; padding:55px 20px; color:#7a7f9a; }
        .empty strong { display:block; color:#d8daE8; font-size:15px; margin-bottom:6px; }
        .skeleton { height:84px; border-radius:13px; margin-bottom:10px; background:linear-gradient(90deg,#121226,#191933,#121226); background-size:200% 100%; animation:sk 1.2s linear infinite; }
        @keyframes sk { to { background-position:-200% 0; } }
        .cap-modal { position:fixed; inset:0; z-index:110; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(3,3,12,.78); backdrop-filter:blur(7px); }
        .cap-panel { width:min(760px,100%); max-height:85vh; overflow:auto; border-radius:17px; border:1px solid #2a2d40; background:linear-gradient(180deg,#14142b,#101023); padding:22px; }
        .modal-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:18px; }
        .modal-title { margin:0; color:#f0f0f5; font-size:18px; }
        .modal-sub { color:#747a96; font-size:12px; margin-top:5px; }
        .modal-x { border:1px solid #2a2d40; background:#101020; color:#cdd2e4; width:36px; height:36px; border-radius:9px; cursor:pointer; }
        .cap-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:9px; }
        .cap-item { padding:0; aspect-ratio:1; overflow:hidden; border-radius:10px; border:2px solid transparent; background:#0d0d1b; cursor:pointer; }
        .cap-item.atual { border-color:#5d6dfa; }
        .cap-item img { width:100%; height:100%; object-fit:cover; display:block; }
        .cfg-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .cfg-field label { display:block; color:#8d92aa; font-size:11px; margin-bottom:6px; }
        .cfg-switch { grid-column:1/-1; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px; border:1px solid #24263d; border-radius:10px; }
        .cfg-switch input { width:18px; height:18px; accent-color:#5d6dfa; }
        .cfg-help { color:#616781; font-size:10px; margin-top:5px; }
        .cfg-actions { margin-top:20px; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
        .cfg-btn { padding:9px 13px; border-radius:9px; border:1px solid #2a2d40; background:#111124; color:#cbd0e3; font:600 12px inherit; cursor:pointer; }
        .cfg-btn.primary { border:0; color:#fff; background:linear-gradient(90deg,#1196fc,#5d0dfa); }
        .cfg-btn.danger { color:#ff9d9d; border-color:rgba(239,68,68,.28); }
        @media(max-width:900px){ .dash-body{padding:34px 24px 70px}.grow{grid-template-columns:62px minmax(150px,1fr) auto}.gstatus{display:none}.gthumb{width:62px;height:52px} }
        @media(max-width:640px){ .dash-body{padding:76px 14px 60px}.dash-h1{font-size:25px}.grow{grid-template-columns:58px 1fr;padding:11px}.gacoes{grid-column:1/-1;justify-content:flex-start}.gthumb{width:58px;height:50px}.pl-input{min-width:100%;max-width:none}.cfg-grid{grid-template-columns:1fr}.cfg-switch{grid-column:auto}.cap-grid{grid-template-columns:repeat(3,minmax(0,1fr))} }
      `}</style>

      <main className="dash-body">
        <div className="dash-top">
          <div><div className="dash-eyebrow">Galerias</div><h1 className="dash-h1">Gerencie suas entregas</h1><div className="dash-sub">Crie, configure e acompanhe cada galeria em um só lugar.</div></div>
          <button className="dash-btn" onClick={() => router.push("/upload")}>+ Nova galeria</button>
        </div>

        {aviso && <div className="dash-aviso" role="status">{aviso}</div>}
        <section className="card">
          <div className="toolbar">
            <input className="pl-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar galeria pelo título" aria-label="Buscar galerias" />
            <div className="ord" aria-label="Ordenar galerias">
              {(["data","nome","estado"] as Ordem[]).map((o) => <button className={"tool"+(ordem===o?" on":"")} key={o} onClick={() => setOrdem(o)}>{o === "data" ? "Recentes" : o === "nome" ? "Nome" : "Estado"}</button>)}
            </div>
          </div>

          {carregando ? <>{[1,2,3].map((x) => <div className="skeleton" key={x}/>)}</> : filtradas.length === 0 ? <div className="empty"><strong>{galerias.length ? "Nenhuma galeria encontrada" : "Você ainda não criou uma galeria"}</strong>{galerias.length ? "Tente outro termo de busca." : "Crie sua primeira entrega para começar."}</div> : <div className="glist">{filtradas.map((g) => { const st=estado(g); const s=selecoes[g.id]; return <article className="grow" key={g.id}>
            <div className="gthumb">{(g.thumbUrl || g.originalUrl) && <img src={g.thumbUrl || g.originalUrl} alt="" onError={(e) => { if (g.originalUrl && e.currentTarget.src !== g.originalUrl) e.currentTarget.src = g.originalUrl; }}/>}</div>
            <div><div className="gname">{g.titulo}</div><div className="gmeta">{g.qtd} foto{g.qtd===1?"":"s"} · criada em {dataCurta(g.criadoEm)}{g.config.prova ? " · modo prova" : ""}</div></div>
            <div className="gstatus"><span className={`badge ${st.cls}`}>{st.texto}</span><span className="gexp">{s ? `${s.fotos.length} escolhida${s.fotos.length===1?"":"s"}${Object.values(s.comentarios).filter(Boolean).length ? ` · ${Object.values(s.comentarios).filter(Boolean).length} comentário(s)` : ""}` : g.config.linkAte ? `link até ${new Date(g.config.linkAte+"T12:00:00").toLocaleDateString("pt-BR")}` : "sem expiração de link"}</span></div>
            <div className="gacoes">
              <button className="act" onClick={() => window.open(`/g/${g.id}`, "_blank", "noopener,noreferrer")}>Ver</button>
              <button className="act" onClick={() => copiarLink(g.id)}>Copiar link</button>
              <button className="act" onClick={() => router.push(`/upload?galeria=${g.id}`)}>Enviar fotos</button>
              {s && <button className="act" onClick={() => setSelecaoModal(g.id)}>Seleção</button>}
              <button className="act" onClick={() => abrirCapa(g)}>Capa</button>
              <button className="act" onClick={() => abrirConfig(g)}>Configurar</button>
              <button className="act danger" onClick={() => excluir(g)}>Excluir</button>
            </div>
          </article>; })}</div>}
        </section>
      </main>

      {modalCfg && <div className="cap-modal" onMouseDown={(e) => { if(e.target===e.currentTarget) setConfigModal(null); }}><section className="cap-panel" role="dialog" aria-modal="true" aria-label={`Configurações de ${modalCfg.titulo}`}>
        <div className="modal-head"><div><h2 className="modal-title">Configurar galeria</h2><div className="modal-sub">{modalCfg.titulo}</div></div><button className="modal-x" onClick={() => setConfigModal(null)} aria-label="Fechar">×</button></div>
        <div className="cfg-grid">
          <div className="cfg-switch"><div><div className="gname">Modo prova</div><div className="cfg-help">Ativa seleção do cliente e regras de prova.</div></div><input type="checkbox" checked={fProva} onChange={(e) => setFProva(e.target.checked)} aria-label="Ativar modo prova"/></div>
          <div className="cfg-field"><label>Limite de seleção</label><input className="pl-input" type="number" min="0" value={fLimite} onChange={(e) => setFLimite(e.target.value)} placeholder="0 = sem limite"/></div>
          <div className="cfg-field"><label>Prazo da seleção</label><input className="pl-input" type="date" value={fPrazo} onChange={(e) => setFPrazo(e.target.value)}/></div>
          <div className="cfg-field"><label>Link válido até</label><input className="pl-input" type="date" value={fLink} onChange={(e) => setFLink(e.target.value)}/></div>
          <div className="cfg-field"><label>{modalCfg.config.temSenha ? "Trocar senha" : "Definir senha"}</label><input className="pl-input" type="password" value={fSenha} onChange={(e) => setFSenha(e.target.value)} placeholder={modalCfg.config.temSenha ? "Digite apenas para trocar" : "Senha da galeria"}/></div>
        </div>
        <div className="cfg-actions">{modalCfg.config.temSenha && <button className="cfg-btn danger" onClick={removerSenha}>Remover senha</button>}<button className="cfg-btn" onClick={() => setConfigModal(null)}>Cancelar</button><button className="cfg-btn primary" onClick={salvarConfig} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button></div>
      </section></div>}

      {modalCapaGaleria && <div className="cap-modal" onMouseDown={(e) => { if(e.target===e.currentTarget) setCapaModal(null); }}><section className="cap-panel" role="dialog" aria-modal="true" aria-label={`Escolher capa de ${modalCapaGaleria.titulo}`}>
        <div className="modal-head"><div><h2 className="modal-title">Escolher capa</h2><div className="modal-sub">As fotos são carregadas somente enquanto este modal está aberto.</div></div><button className="modal-x" onClick={() => setCapaModal(null)} aria-label="Fechar">×</button></div>
        {carregandoCapa ? <div className="empty">Preparando miniaturas…</div> : fotosCapa.length ? <div className="cap-grid">{fotosCapa.map((foto) => <button className={"cap-item"+(modalCapaGaleria.capa===foto.nome?" atual":"")} key={foto.nome} onClick={() => definirCapa(modalCapaGaleria.id,foto)} title={foto.nome}>{(foto.thumb||foto.original) && <img src={foto.thumb||foto.original} alt={foto.nome} onError={(e) => { if(foto.original && e.currentTarget.src!==foto.original) e.currentTarget.src=foto.original; }}/>}</button>)}</div> : <div className="empty">Esta galeria não possui fotos.</div>}
      </section></div>}

      {modalSelGaleria && <ModalSelecao uid={uid} galeriaId={modalSelGaleria.id} titulo={modalSelGaleria.titulo} selecao={selecoes[modalSelGaleria.id]} onFechar={() => setSelecaoModal(null)}/>} 
    </div>
  );
}
