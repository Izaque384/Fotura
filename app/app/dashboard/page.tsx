"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase-client";
import MenuFotografo from "../MenuFotografo";

type Foto = { nome: string; url: string };
type Galeria = { slug: string; qtd: number; fotos: Foto[]; criadoEm?: string };
type Mes = { label: string; qtd: number };

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [porMes, setPorMes] = useState<Mes[]>([]);
  const [aviso, setAviso] = useState("");
  const [capas, setCapas] = useState<Record<string, string>>({});
  const [configs, setConfigs] = useState<Record<string, { prova?: boolean; limite?: number; prazo?: string | null; temSenha?: boolean; linkAte?: string | null }>>({});
  const [configModal, setConfigModal] = useState<string | null>(null);
  const [fProva, setFProva] = useState(false);
  const [fLimite, setFLimite] = useState("");
  const [fPrazo, setFPrazo] = useState("");
  const [fLink, setFLink] = useState("");
  const [fSenha, setFSenha] = useState("");
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const [selecoes, setSelecoes] = useState<Record<string, { fotos: string[]; finalizada: boolean; comentarios: Record<string, string>; atualizadoEm?: string }>>({});
  const [vendoSelecao, setVendoSelecao] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [notifVistoEm, setNotifVistoEm] = useState<string | null>(null);
  const [sinoAberto, setSinoAberto] = useState(false);
  const [ordem, setOrdem] = useState<"data" | "estado">("data");
  const [baixandoSel, setBaixandoSel] = useState(false);
  const [progSel, setProgSel] = useState(0);

  useEffect(() => {
    async function carregar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setEmail(userData.user.email ?? null);

      const { data: perfil } = await supabase
        .from("perfis")
        .select("capas")
        .eq("id", userData.user.id)
        .maybeSingle();
      setCapas((perfil?.capas as Record<string, string>) ?? {});

      const { data: cfgRow } = await supabase
        .from("perfis")
        .select("configs")
        .eq("id", userData.user.id)
        .maybeSingle();
      setConfigs((cfgRow?.configs as Record<string, { prova?: boolean; limite?: number; prazo?: string | null; temSenha?: boolean; linkAte?: string | null }>) ?? {});

      const { data: notifRow } = await supabase
        .from("perfis")
        .select("notif_visto_em")
        .eq("id", userData.user.id)
        .maybeSingle();
      setNotifVistoEm((notifRow?.notif_visto_em as string | null) ?? null);

      const { data, error } = await supabase.storage.from("fotos").list("", {
        limit: 200,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        setAviso("Não foi possível carregar as galerias.");
        setCarregando(false);
        return;
      }

      const pastas = (data ?? []).filter((item) => item.id === null);

      const lista: Galeria[] = [];
      const contagemMes = new Map<string, number>();

      for (const pasta of pastas) {
        const { data: fotos } = await supabase.storage
          .from("fotos")
          .list(pasta.name, { limit: 200 });
        const arquivos = (fotos ?? []).filter((f) => f.id !== null);
        const fotosLista: Foto[] = arquivos.map((f) => ({
          nome: f.name,
          url: supabase.storage.from("fotos").getPublicUrl(`${pasta.name}/${f.name}`).data.publicUrl,
        }));
        const criadoEm = arquivos.reduce<string | undefined>((m, f) => {
          const c = (f as { created_at?: string | null }).created_at ?? undefined;
          return c && (!m || c > m) ? c : m;
        }, undefined);
        lista.push({ slug: pasta.name, qtd: arquivos.length, fotos: fotosLista, criadoEm });

        for (const f of arquivos) {
          if (!f.created_at) continue;
          const d = new Date(f.created_at);
          const chave = `${d.getFullYear()}-${d.getMonth()}`;
          contagemMes.set(chave, (contagemMes.get(chave) ?? 0) + 1);
        }
      }

      // últimos 6 meses (inclui o atual), mesmo que zerados
      const agora = new Date();
      const meses: Mes[] = [];
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const chave = `${dt.getFullYear()}-${dt.getMonth()}`;
        const nome = dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        meses.push({ label: nome, qtd: contagemMes.get(chave) ?? 0 });
      }

      const slugs = lista.map((g) => g.slug);
      const mapaSel: Record<string, { fotos: string[]; finalizada: boolean; comentarios: Record<string, string>; atualizadoEm?: string }> = {};
      if (slugs.length > 0) {
        const { data: sels } = await supabase
          .from("selecoes")
          .select("galeria, fotos, finalizada, comentarios, atualizado_em")
          .in("galeria", slugs);
        for (const s of sels ?? []) {
          mapaSel[s.galeria] = { fotos: (s.fotos as string[]) ?? [], finalizada: Boolean(s.finalizada), comentarios: (s.comentarios as Record<string, string>) ?? {}, atualizadoEm: (s.atualizado_em as string) ?? undefined };
        }
      }
      setSelecoes(mapaSel);

      setGalerias(lista);
      setPorMes(meses);
      setCarregando(false);
    }
    carregar();
  }, [router, supabase]);

  async function copiarLink(slug: string) {
    const link = `${window.location.origin}/g/${slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setAviso("Link copiado: " + link);
    } catch {
      setAviso("Copie manualmente: " + link);
    }
  }

  function titulo(slug: string) {
    const t = slug.replace(/-/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function capaDaGaleria(g: Galeria): string | null {
    const nome = capas[g.slug];
    if (nome) {
      const achou = g.fotos.find((f) => f.nome === nome);
      if (achou) return achou.url;
    }
    return g.fotos[0]?.url ?? null;
  }

  async function definirCapa(slug: string, nome: string) {
    const novas = { ...capas, [slug]: nome };
    setCapas(novas);
    setEscolhendo(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("perfis").upsert({
      id: userData.user.id,
      capas: novas,
      atualizado_em: new Date().toISOString(),
    });
    if (error) setAviso("Não consegui salvar a capa: " + error.message);
    else setAviso("Capa atualizada!");
  }

  if (carregando) {
    return <div className="dash-load">Carregando painel...</div>;
  }

  function qtdSel(slug: string): number {
    return selecoes[slug]?.fotos?.length ?? 0;
  }

  function tempoRel(iso?: string) {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `há ${d} dia${d === 1 ? "" : "s"}`;
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  async function abrirSino() {
    const abrir = !sinoAberto;
    setSinoAberto(abrir);
    if (!abrir) return;
    const temNova = galerias.some((g) => {
      const s = selecoes[g.slug];
      return s?.finalizada && (!notifVistoEm || (s.atualizadoEm && s.atualizadoEm > notifVistoEm));
    });
    if (!temNova) return;
    const agora = new Date().toISOString();
    setNotifVistoEm(agora);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) await supabase.from("perfis").upsert({ id: userData.user.id, notif_visto_em: agora });
  }

  function qtdCom(slug: string): number {
    const c = selecoes[slug]?.comentarios ?? {};
    return Object.values(c).filter((t) => (t ?? "").trim() !== "").length;
  }

  async function baixarUma(url: string, nome: string) {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  }

  async function baixarSelecionadas(fotosSel: Foto[]) {
    if (baixandoSel || fotosSel.length === 0) return;
    setBaixandoSel(true);
    setProgSel(0);
    for (let i = 0; i < fotosSel.length; i++) {
      try {
        await baixarUma(fotosSel[i].url, fotosSel[i].nome);
      } catch {
        // segue para a próxima
      }
      setProgSel(i + 1);
      await new Promise((r) => setTimeout(r, 400));
    }
    setBaixandoSel(false);
  }

  function abrirConfig(slug: string) {
    const c = configs[slug] ?? {};
    setFProva(Boolean(c.prova));
    setFLimite(c.limite ? String(c.limite) : "");
    setFPrazo(c.prazo ?? "");
    setFLink(c.linkAte ?? "");
    setFSenha("");
    setConfigModal(slug);
  }

  async function salvarConfig(slug: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    let temSenha = Boolean(configs[slug]?.temSenha);
    const s = fSenha.trim();
    if (s) {
      const { error: e1 } = await supabase.from("senhas").upsert({ galeria: slug, senha: s, atualizado_em: new Date().toISOString() });
      if (e1) { setAviso("Erro ao salvar senha: " + e1.message); return; }
      temSenha = true;
    }
    const novos = {
      ...configs,
      [slug]: {
        ...(configs[slug] ?? {}),
        prova: fProva,
        limite: Math.max(0, parseInt(fLimite || "0", 10) || 0),
        prazo: fPrazo || null,
        linkAte: fLink || null,
        temSenha,
      },
    };
    setConfigs(novos);
    setConfigModal(null);
    const { error } = await supabase.from("perfis").upsert({ id: userData.user.id, configs: novos, atualizado_em: new Date().toISOString() });
    if (error) setAviso("Erro ao salvar: " + error.message);
    else setAviso("Configurações salvas.");
  }

  async function removerSenhaConfig(slug: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("senhas").delete().eq("galeria", slug);
    const novos = { ...configs, [slug]: { ...(configs[slug] ?? {}), temSenha: false } };
    setConfigs(novos);
    setFSenha("");
    await supabase.from("perfis").upsert({ id: userData.user.id, configs: novos, atualizado_em: new Date().toISOString() });
    setAviso("Senha removida.");
  }

  async function excluirGaleria(g: Galeria) {
    const ok = window.confirm(
      `Excluir a galeria "${titulo(g.slug)}" e todas as suas ${g.qtd} foto${g.qtd === 1 ? "" : "s"}? Esta ação não pode ser desfeita.`
    );
    if (!ok) return;
    const caminhos = g.fotos.map((f) => `${g.slug}/${f.nome}`);
    if (caminhos.length > 0) {
      const { error } = await supabase.storage.from("fotos").remove(caminhos);
      if (error) {
        setAviso("Erro ao excluir as fotos: " + error.message);
        return;
      }
    }
    await supabase.from("selecoes").delete().eq("galeria", g.slug);
    if (capas[g.slug]) {
      const novasCapas = { ...capas };
      delete novasCapas[g.slug];
      setCapas(novasCapas);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from("perfis").upsert({
          id: userData.user.id,
          capas: novasCapas,
          atualizado_em: new Date().toISOString(),
        });
      }
    }
    setGalerias((prev) => prev.filter((x) => x.slug !== g.slug));
    setAviso(`Galeria "${titulo(g.slug)}" excluída.`);
  }

  const totalGalerias = galerias.length;
  const agoraMs = Date.now();
  const notificacoes = galerias
    .filter((g) => selecoes[g.slug]?.finalizada)
    .map((g) => ({ slug: g.slug, nome: titulo(g.slug), qtd: selecoes[g.slug].fotos.length, quando: selecoes[g.slug].atualizadoEm }))
    .filter((n) => {
      const naoLida = !notifVistoEm || (n.quando && n.quando > notifVistoEm);
      if (naoLida) return true;
      return notifVistoEm ? agoraMs - new Date(notifVistoEm).getTime() < 86400000 : false;
    })
    .sort((a, b) => (b.quando ?? "").localeCompare(a.quando ?? ""));
  const naoLidas = notificacoes.filter((n) => !notifVistoEm || (n.quando && n.quando > notifVistoEm)).length;
  const galeriasOrdenadas = [...galerias].sort((a, b) => {
    if (ordem === "estado") {
      const pa = configs[a.slug]?.prova ? 1 : 0;
      const pb = configs[b.slug]?.prova ? 1 : 0;
      if (pa !== pb) return pa - pb;
    }
    return (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "");
  });
  const totalFotos = galerias.reduce((s, g) => s + g.qtd, 0);
  const media = totalGalerias > 0 ? Math.round(totalFotos / totalGalerias) : 0;
  const maior = galerias.reduce<Galeria | null>((m, g) => (!m || g.qtd > m.qtd ? g : m), null);

  const topGal = [...galerias].sort((a, b) => b.qtd - a.qtd).slice(0, 6);
  const maxGal = Math.max(1, ...topGal.map((g) => g.qtd));
  const maxMes = Math.max(1, ...porMes.map((m) => m.qtd));

  return (
    <div className="dash mf-shift">
      <style>{`
        .dash { min-height: 100vh; background: linear-gradient(180deg, #0b0b1a 0%, #101024 100%); color: #f0f0f5; }
        .dash-load {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(180deg, #0b0b1a 0%, #101024 100%); color: #7a7f9a;
        }
        .dash-body { max-width: 1120px; margin: 0 auto; padding: 40px 40px 80px; }

        .dash-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 30px; }
        .dash-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #6f76a0; margin-bottom: 8px; }
        .dash-h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.5px; color: #f5f6fb; margin: 0; }
        .dash-sub { font-size: 13px; color: #7a7f9a; margin-top: 6px; }
        .dash-btn {
          padding: 11px 18px; font-size: 14px; font-weight: 600; border-radius: 11px; cursor: pointer;
          color: #fff; border: none; font-family: inherit;
          background: linear-gradient(90deg, #1196fc, #5d0dfa);
          box-shadow: 0 8px 24px rgba(74,108,247,0.30);
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .dash-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(74,108,247,0.45); }

        .dash-aviso {
          font-size: 13px; color: #8fe3b0; background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.25); border-radius: 10px;
          padding: 10px 14px; margin-bottom: 22px; word-break: break-all;
        }

        /* KPIs */
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
        .kpi {
          position: relative; overflow: hidden;
          background: linear-gradient(180deg, #14142b 0%, #101023 100%);
          border: 1px solid #23233c; border-radius: 16px; padding: 20px;
        }
        .kpi::after {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #1196fc, #5d0dfa); opacity: .55;
        }
        .kpi-ic {
          width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
          background: rgba(74,108,247,0.12); color: #7ea2ff; margin-bottom: 16px;
        }
        .kpi-ic svg { width: 20px; height: 20px; }
        .kpi-val { font-size: 32px; font-weight: 700; line-height: 1; letter-spacing: -1px; color: #f5f6fb; }
        .kpi-lab { font-size: 13px; color: #8a90a8; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Gráficos */
        .charts { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; margin-bottom: 20px; }
        .card { background: linear-gradient(180deg, #14142b 0%, #101023 100%); border: 1px solid #23233c; border-radius: 16px; padding: 22px 24px; }
        .card-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .card-t { font-size: 15px; font-weight: 600; color: #eef1f6; }
        .card-tag { font-size: 11px; color: #6f76a0; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }

        /* Barras horizontais */
        .hbars { display: flex; flex-direction: column; gap: 14px; }
        .hbar { display: grid; grid-template-columns: 130px 1fr 34px; align-items: center; gap: 12px; }
        .hbar-name { font-size: 13px; color: #c3c7db; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hbar-track { height: 10px; background: #1c1c34; border-radius: 999px; overflow: hidden; }
        .hbar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #1196fc, #5d0dfa); min-width: 6px; transition: width .5s ease; }
        .hbar-val { font-size: 13px; font-weight: 600; color: #f0f0f5; text-align: right; }

        /* Barras verticais */
        .vbars { display: flex; align-items: flex-end; gap: 10px; height: 180px; padding-top: 20px; }
        .vbar { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
        .vbar-area { width: 100%; display: flex; align-items: flex-end; justify-content: center; flex: 1; }
        .vbar-fill { position: relative; width: 60%; max-width: 40px; border-radius: 8px 8px 2px 2px; background: linear-gradient(180deg, #1196fc, #5d0dfa); transition: height .5s ease; }
        .vbar-num { position: absolute; top: -20px; left: 0; right: 0; text-align: center; font-size: 12px; font-weight: 600; color: #c3c7db; }
        .vbar-lab { font-size: 11px; color: #7a7f9a; margin-top: 10px; text-transform: capitalize; }

        .chart-vazio { font-size: 13px; color: #7a7f9a; text-align: center; padding: 30px 0; }

        /* Lista de galerias */
        .glist { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
        .grow {
          position: relative;
          display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
          border: 1.5px solid transparent; border-radius: 13px; padding: 16px 18px;
          background: linear-gradient(#141428, #141428) padding-box, var(--brd, linear-gradient(#23233c, #23233c)) border-box;
          transition: background .15s ease;
        }
        .grow:hover { background: linear-gradient(#191934, #191934) padding-box, var(--brd, linear-gradient(#33364f, #33364f)) border-box; }
        .grow.prova { --brd: linear-gradient(135deg, #f6c445, #ee8b2b); }
        .grow.entrega { --brd: linear-gradient(135deg, #1196fc, #5d0dfa); }
        .ord-wrap { display: flex; align-items: center; gap: 12px; }
        .ord { display: inline-flex; background: rgba(255,255,255,0.03); border: 1px solid #2a2d40; border-radius: 9px; padding: 2px; }
        .ord-b { padding: 5px 12px; font-size: 12px; font-weight: 600; color: #8a90a8; background: none; border: none; border-radius: 7px; cursor: pointer; font-family: inherit; }
        .ord-b.on { background: rgba(74,108,247,0.18); color: #cdd2e4; }
        .gname { font-size: 15px; font-weight: 600; color: #f0f0f5; }
        .gqtd { font-size: 12px; color: #7a7f9a; margin-top: 2px; }
        .gsel-badge { display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: rgba(74,108,247,0.15); color: #9fb0ff; vertical-align: middle; }
        .gsel-badge.fin { background: rgba(34,197,94,0.15); color: #8fe3b0; }
        .gsel-badge.com { background: rgba(147,112,219,0.16); color: #c3aeff; }
        .gacoes { display: flex; gap: 8px; flex-wrap: wrap; }
        .gmenu-wrap { position: relative; }
        .gmenu-btn { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 9px; background: rgba(255,255,255,0.03); border: 1px solid #2a2d40; color: #cdd2e4; cursor: pointer; }
        .gmenu-btn:hover { border-color: #4a6cf7; color: #fff; }
        .gmenu-btn svg { width: 20px; height: 20px; }
        .gmenu-overlay { position: fixed; inset: 0; z-index: 40; }
        .gmenu { position: absolute; z-index: 41; right: 0; top: 50%; transform: translateY(-50%); min-width: 200px; background: #16162c; border: 1px solid #2a2d44; border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.5); padding: 6px; }
        .gmenu button { display: block; width: 100%; text-align: left; padding: 10px 12px; font-size: 14px; color: #cdd2e4; background: none; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; }
        .gmenu button:hover { background: #1e1e38; color: #fff; }
        .gmenu button.perigo { color: #ff8f8f; }
        .gmenu button.perigo:hover { background: rgba(239,68,68,0.12); }
        .gmenu .grad-txt { background-image: linear-gradient(90deg,#1196fc,#5d0dfa); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; font-weight: 700; }
        .gmenu button.on { background: rgba(34,197,94,0.14); color: #8fe3b0; }
        .gmenu button.on:hover { background: rgba(34,197,94,0.2); color: #a7f0c3; }
        .gmenu button.off { background: rgba(239,68,68,0.12); color: #ff9d9d; }
        .gmenu button.off:hover { background: rgba(239,68,68,0.18); color: #ffb3b3; }
        .gmenu-sep { height: 1px; background: #23233c; margin: 6px 4px; }
        .pl-panel { max-width: 460px; }
        .pl-form { padding: 20px 22px 20px; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
        .pl-foot { flex-shrink: 0; padding: 15px 22px; border-top: 1px solid #23233c; background: #12122a; }
        .pl-label { display: block; font-size: 13px; color: #a0a4b8; margin: 6px 0 6px; }
        .pl-input { width: 100%; padding: 11px 13px; font-size: 14px; border: 1.5px solid #2a2d40; border-radius: 10px; background: #0f0f1a; color: #f0f0f5; outline: none; box-sizing: border-box; margin-bottom: 6px; font-family: inherit; color-scheme: dark; }
        .pl-input:focus { border-color: #4a6cf7; }
        .pl-hint { font-size: 11px; color: #6f76a0; margin-bottom: 18px; }
        .pl-save { width: 100%; padding: 12px; font-size: 14px; font-weight: 700; color: #fff; border: none; border-radius: 11px; cursor: pointer; font-family: inherit; background: linear-gradient(90deg,#1196fc,#5d0dfa); }
        .pl-save:hover { filter: brightness(1.08); }
        .pl-remover { width: 100%; margin-top: 10px; padding: 11px; font-size: 13px; font-weight: 600; color: #ff9d9d; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 11px; cursor: pointer; font-family: inherit; }
        .pl-remover:hover { background: rgba(239,68,68,0.16); }
        .cfg-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 2px 0 16px; }
        .cfg-txt { min-width: 0; }
        .cfg-t { font-size: 14px; font-weight: 600; color: #f0f0f5; }
        .cfg-d { font-size: 12px; color: #7a7f9a; margin-top: 2px; }
        .cfg-switch { flex-shrink: 0; width: 46px; height: 26px; border-radius: 999px; border: none; background: #2a2d40; cursor: pointer; position: relative; transition: background .15s ease; }
        .cfg-switch span { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: left .15s ease; }
        .cfg-switch.on { background: linear-gradient(90deg,#f6c445,#ee8b2b); }
        .cfg-switch.on span { left: 23px; }
        .gacao { padding: 8px 14px; font-size: 13px; font-weight: 600; border-radius: 9px; cursor: pointer; text-decoration: none; display: inline-block; font-family: inherit; }
        .gacao-linha { background: transparent; color: #9fb0ff; border: 1px solid #34385a; }
        .gacao-linha:hover { border-color: #4a6cf7; color: #fff; }
        .gacao-azul { background: linear-gradient(90deg, #1196fc, #5d0dfa); color: #fff; border: none; }

        .ginfo { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .gcapa { position: relative; width: 60px; height: 60px; flex-shrink: 0; border-radius: 11px; overflow: hidden; border: 1px solid #2a2d40; background: #0f0f1a; cursor: pointer; padding: 0; }
        .gcapa:disabled { cursor: default; }
        .gcapa img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .gcapa-vazia { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 10px; color: #5a5f78; }
        .gcapa-hover { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #fff; background: rgba(11,11,26,0.55); opacity: 0; transition: opacity .15s ease; }
        .gcapa:hover .gcapa-hover { opacity: 1; }

        .cap-modal { position: fixed; inset: 0; z-index: 60; background: rgba(4,4,10,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .cap-panel { width: 100%; max-width: 720px; max-height: 82vh; display: flex; flex-direction: column; background: #12122a; border: 1px solid #262642; border-radius: 18px; overflow: hidden; }
        .cap-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 22px; border-bottom: 1px solid #23233c; }
        .cap-title { font-size: 16px; font-weight: 700; color: #f5f6fb; }
        .cap-sub { font-size: 13px; color: #7a7f9a; margin-top: 2px; }
        .cap-x { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); border: 1px solid #2a2d40; color: #cdd2e4; cursor: pointer; flex-shrink: 0; }
        .cap-x:hover { border-color: #4a6cf7; color: #fff; }
        .cap-x svg { width: 18px; height: 18px; }
        .cap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; padding: 20px 22px; overflow-y: auto; }
        .cap-item { position: relative; aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; border: 2px solid transparent; cursor: pointer; padding: 0; background: #0f0f1a; }
        .cap-item img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s ease; }
        .cap-item:hover img { transform: scale(1.06); }
        .cap-item.ativa { border-color: #4a6cf7; }
        .cap-check { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; border-radius: 50%; background: #4a6cf7; color: #fff; font-size: 13px; display: flex; align-items: center; justify-content: center; }
        .cap-foot { padding: 16px 22px; border-top: 1px solid #23233c; display: flex; justify-content: flex-end; }
        .sel-vazio { padding: 44px 22px; text-align: center; color: #7a7f9a; font-size: 14px; }
        .sel-scroll { flex: 1; min-height: 0; overflow-y: auto; }
        .sel-scroll .cap-grid { overflow: visible; }
        .com-sec { padding: 8px 22px 22px; }
        .com-sec-h { font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #6f76a0; margin: 8px 0 12px; }
        .com-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-top: 1px solid #1e2036; }
        .com-row img { width: 52px; height: 52px; border-radius: 9px; object-fit: cover; flex-shrink: 0; }
        .com-body { min-width: 0; }
        .com-txt { margin: 0; font-size: 14px; color: #e6e9f5; line-height: 1.45; }
        .com-tag { display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 600; color: #9fb0ff; background: rgba(74,108,247,0.14); padding: 2px 8px; border-radius: 999px; }

        .dash-vazio {
          text-align: center; padding: 48px 24px; border: 1px dashed #2a2d40; border-radius: 16px;
          background: rgba(255,255,255,0.02);
        }
        .sino-wrap { position: relative; }
        .sino-btn { position: relative; width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid #2a2d40; color: #cdd2e4; cursor: pointer; }
        .sino-btn:hover { border-color: #4a6cf7; color: #fff; }
        .sino-btn svg { width: 23px; height: 23px; }
        .sino-badge { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: #ef4444; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
        .sino-overlay { position: fixed; inset: 0; z-index: 40; }
        .sino-menu { position: absolute; z-index: 41; right: 0; top: 50px; width: 320px; max-width: 86vw; max-height: 60vh; overflow-y: auto; background: #16162c; border: 1px solid #2a2d44; border-radius: 14px; box-shadow: 0 16px 40px rgba(0,0,0,0.5); padding: 8px; }
        .sino-h { font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #6f76a0; padding: 6px 10px 10px; }
        .sino-item { display: flex; gap: 10px; align-items: flex-start; width: 100%; text-align: left; padding: 10px; border: none; background: none; border-radius: 10px; cursor: pointer; font-family: inherit; }
        .sino-item:hover { background: #1e1e38; }
        .sino-dot { width: 8px; height: 8px; border-radius: 50%; background: #4a6cf7; margin-top: 6px; flex-shrink: 0; }
        .sino-dot.lida { background: transparent; border: 1px solid #3a3f5a; }
        .sino-item-t { display: block; font-size: 14px; color: #f0f0f5; font-weight: 600; }
        .sino-item-d { display: block; font-size: 12px; color: #8a90a8; margin-top: 2px; }
        .sino-vazio { padding: 20px 12px; text-align: center; color: #7a7f9a; font-size: 13px; }
        .dash-vazio-t { font-size: 16px; font-weight: 600; color: #f0f0f5; margin-bottom: 6px; }
        .dash-vazio-d { font-size: 13px; color: #7a7f9a; margin-bottom: 20px; }

        @media (max-width: 980px) {
          .kpis { grid-template-columns: repeat(2, 1fr); }
          .charts { grid-template-columns: 1fr; }
        }
        @media (max-width: 860px) {
          .dash-body { padding: 28px 20px 70px; }
        }
        @media (max-width: 520px) {
          .hbar { grid-template-columns: 96px 1fr 30px; gap: 8px; }
        }
      `}</style>

      <MenuFotografo />

      <div className="dash-body">
        <div className="dash-top">
          <div>
            <div className="dash-eyebrow">Painel</div>
            <h1 className="dash-h1">Sua visão geral</h1>
            <div className="dash-sub">{email}</div>
          </div>
          <div className="sino-wrap">
            <button className="sino-btn" onClick={abrirSino} aria-label="Notificações" title="Notificações">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              {naoLidas > 0 && <span className="sino-badge">{naoLidas}</span>}
            </button>
            {sinoAberto && (
              <>
                <div className="sino-overlay" onClick={() => setSinoAberto(false)} />
                <div className="sino-menu">
                  <div className="sino-h">Seleções finalizadas</div>
                  {notificacoes.length === 0 ? (
                    <div className="sino-vazio">Nenhuma seleção finalizada ainda.</div>
                  ) : (
                    notificacoes.map((n) => {
                      const naoLida = !notifVistoEm || (n.quando && n.quando > notifVistoEm);
                      return (
                        <button key={n.slug} className="sino-item" onClick={() => { setSinoAberto(false); setVendoSelecao(n.slug); }}>
                          <span className={"sino-dot" + (naoLida ? "" : " lida")} />
                          <span>
                            <span className="sino-item-t">{n.nome}</span>
                            <span className="sino-item-d">{n.qtd} foto{n.qtd === 1 ? "" : "s"} selecionada{n.qtd === 1 ? "" : "s"} · {tempoRel(n.quando)}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {aviso && <p className="dash-aviso">{aviso}</p>}

        <section className="kpis">
          <div className="kpi">
            <div className="kpi-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            </div>
            <div className="kpi-val">{totalGalerias}</div>
            <div className="kpi-lab">Galerias</div>
          </div>
          <div className="kpi">
            <div className="kpi-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l4.5-4.5 3.5 3 3-2.5L21 17"/></svg>
            </div>
            <div className="kpi-val">{totalFotos}</div>
            <div className="kpi-lab">Fotos no total</div>
          </div>
          <div className="kpi">
            <div className="kpi-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16l3.5-4 3 2.5L20 8"/></svg>
            </div>
            <div className="kpi-val">{media}</div>
            <div className="kpi-lab">Média por galeria</div>
          </div>
          <div className="kpi">
            <div className="kpi-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9 6.8 19.8l1-5.8L3.6 9.9l5.8-.8z"/></svg>
            </div>
            <div className="kpi-val">{maior ? maior.qtd : 0}</div>
            <div className="kpi-lab">{maior ? "Maior: " + titulo(maior.slug) : "Maior galeria"}</div>
          </div>
        </section>

        {totalGalerias === 0 ? (
          <div className="dash-vazio">
            <div className="dash-vazio-t">Seu painel está pronto pra começar</div>
            <div className="dash-vazio-d">Crie sua primeira galeria e os números aparecem aqui.</div>
            <button className="dash-btn" onClick={() => router.push("/upload")}>Criar nova galeria</button>
          </div>
        ) : (
          <>
            <section className="charts">
              <div className="card">
                <div className="card-h">
                  <span className="card-t">Fotos por galeria</span>
                  <span className="card-tag">Top {topGal.length}</span>
                </div>
                <div className="hbars">
                  {topGal.map((g) => (
                    <div className="hbar" key={g.slug}>
                      <div className="hbar-name" title={titulo(g.slug)}>{titulo(g.slug)}</div>
                      <div className="hbar-track">
                        <div className="hbar-fill" style={{ width: `${Math.max(6, (g.qtd / maxGal) * 100)}%` }} />
                      </div>
                      <div className="hbar-val">{g.qtd}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-h">
                  <span className="card-t">Envios por mês</span>
                  <span className="card-tag">6 meses</span>
                </div>
                {porMes.every((m) => m.qtd === 0) ? (
                  <div className="chart-vazio">Ainda sem envios nos últimos meses.</div>
                ) : (
                  <div className="vbars">
                    {porMes.map((m, i) => (
                      <div className="vbar" key={i}>
                        <div className="vbar-area">
                          <div className="vbar-fill" style={{ height: `${m.qtd === 0 ? 0 : Math.max(6, (m.qtd / maxMes) * 130)}px` }}>
                            <span className="vbar-num">{m.qtd}</span>
                          </div>
                        </div>
                        <div className="vbar-lab">{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-h">
                <span className="card-t">Suas galerias</span>
                <div className="ord-wrap">
                  <span className="card-tag">{totalGalerias} no total</span>
                  <div className="ord">
                    <button className={"ord-b" + (ordem === "data" ? " on" : "")} onClick={() => setOrdem("data")}>Data</button>
                    <button className={"ord-b" + (ordem === "estado" ? " on" : "")} onClick={() => setOrdem("estado")}>Estado</button>
                  </div>
                </div>
              </div>
              <div className="glist">
                {galeriasOrdenadas.map((g) => (
                  <div className={"grow " + (configs[g.slug]?.prova ? "prova" : "entrega")} key={g.slug}>
                    <div className="ginfo">
                      <button
                        className="gcapa"
                        onClick={() => g.qtd > 0 && setEscolhendo(g.slug)}
                        disabled={g.qtd === 0}
                        title={g.qtd > 0 ? "Trocar capa" : "Sem fotos"}
                        aria-label="Trocar capa"
                      >
                        {capaDaGaleria(g) ? (
                          <img src={capaDaGaleria(g) as string} alt="Capa" />
                        ) : (
                          <span className="gcapa-vazia">sem foto</span>
                        )}
                        {g.qtd > 0 && <span className="gcapa-hover">Trocar</span>}
                      </button>
                      <div>
                        <div className="gname">{titulo(g.slug)}</div>
                        <div className="gqtd">
                          {g.qtd} foto{g.qtd === 1 ? "" : "s"}
                          {qtdSel(g.slug) > 0 && (
                            <span className={"gsel-badge" + (selecoes[g.slug]?.finalizada ? " fin" : "")}>
                              {qtdSel(g.slug)} selecionada{qtdSel(g.slug) === 1 ? "" : "s"}{selecoes[g.slug]?.finalizada ? " ✓" : ""}
                            </span>
                          )}
                          {qtdCom(g.slug) > 0 && (
                            <span className="gsel-badge com">{qtdCom(g.slug)} comentário{qtdCom(g.slug) === 1 ? "" : "s"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="gacoes">
                      <div className="gmenu-wrap">
                        <button className="gmenu-btn" onClick={() => setMenuAberto(menuAberto === g.slug ? null : g.slug)} aria-label="Opções da galeria" title="Opções">
                          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                        </button>
                        {menuAberto === g.slug && (
                          <>
                            <div className="gmenu-overlay" onClick={() => setMenuAberto(null)} />
                            <div className="gmenu">
                              {(qtdSel(g.slug) > 0 || qtdCom(g.slug) > 0) && (
                                <button onClick={() => { setMenuAberto(null); setVendoSelecao(g.slug); }}>Ver seleção</button>
                              )}
                              <button onClick={() => { setMenuAberto(null); copiarLink(g.slug); }}>Copiar link</button>
                              <button onClick={() => { setMenuAberto(null); window.open(`/g/${g.slug}`, "_blank"); }}><span className="grad-txt">Ver galeria</span></button>
                              <button onClick={() => { setMenuAberto(null); router.push(`/upload?galeria=${g.slug}`); }}>Enviar mais fotos</button>
                              <button onClick={() => { setMenuAberto(null); abrirConfig(g.slug); }}>Configurações…</button>
                              <div className="gmenu-sep" />
                              <button className="perigo" onClick={() => { setMenuAberto(null); excluirGaleria(g); }}>Excluir galeria</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {escolhendo && (() => {
        const g = galerias.find((x) => x.slug === escolhendo);
        if (!g) return null;
        return (
          <div className="cap-modal" onClick={() => setEscolhendo(null)}>
            <div className="cap-panel" onClick={(e) => e.stopPropagation()}>
              <div className="cap-head">
                <div>
                  <div className="cap-title">Escolher capa</div>
                  <div className="cap-sub">{titulo(g.slug)}</div>
                </div>
                <button className="cap-x" onClick={() => setEscolhendo(null)} aria-label="Fechar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                </button>
              </div>
              <div className="cap-grid">
                {g.fotos.map((f) => {
                  const ativa = capas[g.slug] === f.nome;
                  return (
                    <button
                      key={f.nome}
                      className={"cap-item" + (ativa ? " ativa" : "")}
                      onClick={() => definirCapa(g.slug, f.nome)}
                      title="Definir como capa"
                    >
                      <img src={f.url} alt="Foto" loading="lazy" />
                      {ativa && <span className="cap-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {vendoSelecao && (() => {
        const g = galerias.find((x) => x.slug === vendoSelecao);
        if (!g) return null;
        const sel = selecoes[g.slug];
        const nomes = sel?.fotos ?? [];
        const fotosSel = g.fotos.filter((f) => nomes.includes(f.nome));
        const coments = g.fotos.filter((f) => (sel?.comentarios?.[f.nome] ?? "").trim() !== "");
        return (
          <div className="cap-modal" onClick={() => setVendoSelecao(null)}>
            <div className="cap-panel" onClick={(e) => e.stopPropagation()}>
              <div className="cap-head">
                <div>
                  <div className="cap-title">Seleção do cliente</div>
                  <div className="cap-sub">
                    {titulo(g.slug)} · {fotosSel.length} foto{fotosSel.length === 1 ? "" : "s"}
                    {coments.length > 0 ? ` · ${coments.length} comentário${coments.length === 1 ? "" : "s"}` : ""}
                    {sel?.finalizada ? " · finalizada" : " · em andamento"}
                  </div>
                </div>
                <button className="cap-x" onClick={() => setVendoSelecao(null)} aria-label="Fechar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                </button>
              </div>
              {fotosSel.length === 0 && coments.length === 0 ? (
                <div className="sel-vazio">O cliente ainda não escolheu nem comentou nenhuma foto.</div>
              ) : (
                <>
                  <div className="sel-scroll">
                    {fotosSel.length > 0 && (
                      <div className="cap-grid">
                        {fotosSel.map((f) => (
                          <div className="cap-item" key={f.nome}>
                            <img src={f.url} alt="Foto" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    )}
                    {coments.length > 0 && (
                      <div className="com-sec">
                        <div className="com-sec-h">Comentários do cliente</div>
                        {coments.map((f) => (
                          <div className="com-row" key={f.nome}>
                            <img src={f.url} alt="Foto" loading="lazy" />
                            <div className="com-body">
                              <p className="com-txt">{sel?.comentarios?.[f.nome]}</p>
                              {nomes.includes(f.nome) && <span className="com-tag">selecionada</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {fotosSel.length > 0 && (
                    <div className="cap-foot">
                      <button className="dash-btn" onClick={() => baixarSelecionadas(fotosSel)} disabled={baixandoSel}>
                        {baixandoSel ? `Baixando ${progSel}/${fotosSel.length}` : `Baixar selecionadas (${fotosSel.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {configModal && (() => {
        const g = galerias.find((x) => x.slug === configModal);
        if (!g) return null;
        const tem = Boolean(configs[g.slug]?.temSenha);
        return (
          <div className="cap-modal" onClick={() => setConfigModal(null)}>
            <div className="cap-panel pl-panel" onClick={(e) => e.stopPropagation()}>
              <div className="cap-head">
                <div>
                  <div className="cap-title">Configurações da galeria</div>
                  <div className="cap-sub">{titulo(g.slug)}</div>
                </div>
                <button className="cap-x" onClick={() => setConfigModal(null)} aria-label="Fechar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                </button>
              </div>
              <div className="pl-form">
                <div className="cfg-row">
                  <div className="cfg-txt">
                    <div className="cfg-t">Marca-d'água (modo prova)</div>
                    <div className="cfg-d">Protege as fotos e esconde o download do cliente.</div>
                  </div>
                  <button type="button" className={"cfg-switch" + (fProva ? " on" : "")} onClick={() => setFProva(!fProva)} aria-label="Alternar marca-d'água"><span /></button>
                </div>

                <label className="pl-label">Limite de seleção</label>
                <input type="number" min="0" className="pl-input" value={fLimite} onChange={(e) => setFLimite(e.target.value)} placeholder="0" />
                <div className="pl-hint">Quantas fotos o cliente pode escolher. 0 ou vazio = sem limite.</div>

                <label className="pl-label">Prazo da seleção</label>
                <input type="date" className="pl-input" value={fPrazo} onChange={(e) => setFPrazo(e.target.value)} />
                <div className="pl-hint">Depois dessa data a seleção fecha para o cliente. Em branco = sem prazo.</div>

                <label className="pl-label">Validade do link</label>
                <input type="date" className="pl-input" value={fLink} onChange={(e) => setFLink(e.target.value)} />
                <div className="pl-hint">Depois dessa data o link para de abrir. Em branco = sem validade.</div>

                <label className="pl-label">Senha da galeria</label>
                <input type="text" className="pl-input" value={fSenha} onChange={(e) => setFSenha(e.target.value)} placeholder={tem ? "Digite para trocar" : "Sem senha"} />
                <div className="pl-hint">{tem ? "Esta galeria já tem senha. Digite uma nova para trocá-la." : "O cliente precisa digitar essa senha para ver as fotos. Em branco = sem senha."}</div>
                {tem && <button className="pl-remover" onClick={() => removerSenhaConfig(g.slug)}>Remover senha</button>}
              </div>
              <div className="pl-foot">
                <button className="pl-save" onClick={() => salvarConfig(g.slug)}>Salvar</button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}