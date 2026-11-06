"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import MenuFotografo from "../../MenuFotografo";

const BUCKET = "client-avatars";
type Cliente = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  criado_em: string;
  avatar_path: string | null;
  observacoes: string;
  etiquetas: string[];
};
type Projeto = {
  id: string;
  nome: string;
  cliente_id: string | null;
  criado_em: string;
  atualizado_em: string;
};
type Galeria = {
  id: string;
  titulo: string;
  cliente_id: string | null;
  projeto_id: string | null;
  prova: boolean;
  etapa: string;
  criado_em: string;
  entrega_publicada_em: string | null;
};
type Selecao = {
  galeria: string;
  finalizada: boolean;
  atualizado_em: string | null;
};
type Filtro = "todos" | "com" | "sem" | "aguardando" | "entregues";
type Aba = "resumo" | "trabalhos" | "historico";
type Formulario = { nome: string; email: string; telefone: string; observacoes: string; etiquetas: string };
const FORM_VAZIO: Formulario = { nome: "", email: "", telefone: "", observacoes: "", etiquetas: "" };

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => (p[0] || "").toLocaleUpperCase("pt-BR")).join("") || "C";
}
function dataCurta(data: string | null | undefined) {
  if (!data) return "";
  const timestamp = new Date(data);
  return Number.isNaN(timestamp.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(timestamp);
}
function normalizarTelefone(value: string) {
  let num = value.replace(/\D/g, "");
  if (num.startsWith("55") && (num.length === 12 || num.length === 13)) num = num.slice(2);
  return num;
}
function urlWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "https://wa.me/55" + digits;
  if (digits.length >= 12 && digits.length <= 15) return "https://wa.me/" + digits;
  return null;
}
function parseTags(value: string) {
  const tags: string[] = [];
  for (const raw of value.split(",")) {
    const tag = raw.trim().slice(0, 24);
    if (tag && !tags.some((t) => t.toLocaleLowerCase("pt-BR") === tag.toLocaleLowerCase("pt-BR"))) tags.push(tag);
    if (tags.length === 8) break;
  }
  return tags;
}
async function recortarAvatar(file: File, zoom: number, posX: number, posY: number) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const tamanho = 420;
    canvas.width = tamanho;
    canvas.height = tamanho;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a fotografia.");
    const escala = Math.max(tamanho / bitmap.width, tamanho / bitmap.height) * zoom;
    const w = bitmap.width * escala, h = bitmap.height * escala;
    const x = (tamanho - w) * posX / 100;
    const y = (tamanho - h) * posY / 100;
    ctx.drawImage(bitmap, x, y, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .85));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error("Não foi possível preparar a imagem.");
    return blob;
  } finally {
    bitmap.close();
  }
}
function CampoAvatar({ cliente, url, size }: { cliente: Cliente; url?: string; size?: "large" }) {
  return (
    <div className="ftc-avatar" style={size === "large" ? { width: 76, height: 76, fontSize: 22 } : undefined} aria-hidden="true">
      {url ? <img alt="" src={url} referrerPolicy="no-referrer" /> : iniciais(cliente.nome)}
    </div>
  );
}
function resumoEtapa(g: Galeria, selecoes: Record<string, Selecao>) {
  if (g.etapa === "entrega" || !!g.entrega_publicada_em) return "Entregue";
  if (g.etapa === "preparando_entrega") return "Preparando entrega";
  const selecao = selecoes[g.id];
  if (g.etapa === "selecao_finalizada" || selecao?.finalizada) return "Seleção finalizada";
  return g.prova ? "Aguardando seleção" : "Em andamento";
}

export default function ClientesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [uid, setUid] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [selecoes, setSelecoes] = useState<Record<string, Selecao>>({});
  const [signedAvatars, setSignedAvatars] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aviso, setAviso] = useState("");
  const [avisoErro, setAvisoErro] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("resumo");
  const [editor, setEditor] = useState<"novo" | string | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  const [permitirDuplicado, setPermitirDuplicado] = useState(false);
  const [imagem, setImagem] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [removerFoto, setRemoverFoto] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const [galeriaPicker, setGaleriaPicker] = useState(false);
  const [galeriaId, setGaleriaId] = useState("");
  const [imagensGaleria, setImagensGaleria] = useState<{ path: string; url: string }[]>([]);
  const [carregandoGaleria, setCarregandoGaleria] = useState(false);
  const [erroGaleria, setErroGaleria] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const carregarAvatares = useCallback(async (lista: Cliente[]) => {
    const caminhos = Array.from(new Set(lista.map((c) => c.avatar_path).filter((x): x is string => !!x)));
    if (!caminhos.length) { setSignedAvatars({}); return; }
    const next: Record<string, string> = {};
    for (let i = 0; i < caminhos.length; i += 50) {
      const batch = caminhos.slice(i, i + 50);
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(batch, 3600);
      data?.forEach((item, index) => { if (item.signedUrl) next[batch[index]] = item.signedUrl; });
    }
    setSignedAvatars(next);
  }, [supabase]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!ativo) return;
      if (!auth.user) { router.replace("/login"); return; }
      setUid(auth.user.id);
      const [a, b, c] = await Promise.all([
        supabase.from("clientes").select("id,nome,email,telefone,criado_em,avatar_path,observacoes,etiquetas").eq("user_id", auth.user.id).order("nome"),
        supabase.from("galeria_projetos").select("id,nome,cliente_id,criado_em,atualizado_em").eq("user_id", auth.user.id).order("atualizado_em", { ascending: false }),
        supabase.from("galerias").select("id,titulo,cliente_id,projeto_id,prova,etapa,criado_em,entrega_publicada_em").eq("user_id", auth.user.id).order("criado_em", { ascending: false })
      ]);
      if (!ativo) return;
      if (a.error || b.error || c.error) {
        setAvisoErro(true);
        setAviso("Não foi possível carregar seus clientes. Atualize a página e tente novamente.");
        setCarregando(false);
        return;
      }
      const clientList = (a.data || []) as Cliente[];
      const pastas = (c.data || []) as Galeria[];
      setClientes(clientList);
      setProjetos((b.data || []) as Projeto[]);
      setGalerias(pastas);
      setCarregando(false);
      const ids = pastas.map((g) => g.id);
      if (ids.length) {
        const { data: s } = await supabase.from("selecoes").select("galeria,finalizada,atualizado_em").in("galeria", ids);
        if (ativo) {
          const mapa: Record<string, Selecao> = {};
          (s || []).forEach((value) => { mapa[value.galeria] = value as Selecao; });
          setSelecoes(mapa);
        }
      }
      if (ativo) await carregarAvatares(clientList);
    })().catch(() => { if (ativo) { setCarregando(false); setAvisoErro(true); setAviso("Não foi possível abrir sua base de clientes."); } });
    return () => { ativo = false; };
  }, [router, supabase, carregarAvatares]);

  useEffect(() => {
    if (!imagem) { setPreview(""); return; }
    const url = URL.createObjectURL(imagem);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imagem]);

  useEffect(() => {
    if (!selecionado && !editor) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !salvando && !excluindo) {
        if (editor) setEditor(null);
        else { setSelecionado(null); setConfirmarExclusao(false); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = old; document.removeEventListener("keydown", keydown); };
  }, [selecionado, editor, salvando, excluindo]);

  const projetoPorId = useMemo(() => {
    const out: Record<string, Projeto> = {};
    projetos.forEach((p) => { out[p.id] = p; });
    return out;
  }, [projetos]);

  const galeriasDe = useCallback((id: string) => {
    return galerias.filter((g) => g.cliente_id === id || !!(g.projeto_id && projetoPorId[g.projeto_id]?.cliente_id === id));
  }, [galerias, projetoPorId]);
  const projetosDe = useCallback((id: string) => projetos.filter((p) => p.cliente_id === id), [projetos]);
  const temPendente = useCallback((id: string) => galeriasDe(id).some((g) => resumoEtapa(g, selecoes) === "Aguardando seleção"), [galeriasDe, selecoes]);
  const temEntregue = useCallback((id: string) => galeriasDe(id).some((g) => resumoEtapa(g, selecoes) === "Entregue"), [galeriasDe, selecoes]);
  const comProjetos = clientes.filter((c) => projetosDe(c.id).length > 0 || galeriasDe(c.id).length > 0).length;
  const aguardando = clientes.filter((c) => temPendente(c.id)).length;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return clientes.filter((c) => {
      const total = projetosDe(c.id).length + galeriasDe(c.id).length;
      const match = !q || [c.nome, c.email || "", c.telefone || "", ...(c.etiquetas || [])]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(q));
      const status =
        filtro === "todos" || (filtro === "com" && total > 0) || (filtro === "sem" && !total) ||
        (filtro === "aguardando" && temPendente(c.id)) || (filtro === "entregues" && temEntregue(c.id));
      return match && status;
    });
  }, [clientes, busca, filtro, galeriasDe, projetosDe, temPendente, temEntregue]);

  const clienteSelecionado = clientes.find((c) => c.id === selecionado) || null;
  const clienteEditando = editor && editor !== "novo" ? clientes.find((c) => c.id === editor) || null : null;

  const duplicado = useMemo(() => {
    const mail = form.email.trim().toLowerCase();
    const phone = normalizarTelefone(form.telefone);
    return clientes.find((c) => c.id !== editor && (
      (mail && c.email?.trim().toLowerCase() === mail) ||
      (phone.length >= 10 && normalizarTelefone(c.telefone || "") === phone)
    )) || null;
  }, [clientes, editor, form.email, form.telefone]);

  function abrirNovo() {
    setForm({ ...FORM_VAZIO });
    setEditor("novo");
    setSelecionado(null);
    setErroForm("");
    setImagem(null);
    setRemoverFoto(false);
    setPermitirDuplicado(false);
    setZoom(1); setPosX(50); setPosY(50);
    setGaleriaPicker(false); setGaleriaId(""); setImagensGaleria([]); setErroGaleria("");
  }
  function abrirEditor(cliente: Cliente) {
    setForm({ nome: cliente.nome, email: cliente.email || "", telefone: cliente.telefone || "", observacoes: cliente.observacoes || "", etiquetas: (cliente.etiquetas || []).join(", ") });
    setEditor(cliente.id);
    setSelecionado(null);
    setErroForm("");
    setImagem(null);
    setRemoverFoto(false);
    setPermitirDuplicado(false);
    setZoom(1); setPosX(50); setPosY(50);
    setGaleriaPicker(false); setGaleriaId(""); setImagensGaleria([]); setErroGaleria("");
  }
  function escolherFoto(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setErroForm("Escolha uma imagem JPG, PNG ou WEBP de até 8 MB.");
      return;
    }
    setErroForm("");
    setImagem(file);
    setRemoverFoto(false);
    setZoom(1); setPosX(50); setPosY(50);
  }
  async function carregarFotosDaGaleria(id: string) {
    if (!uid || !id) { setImagensGaleria([]); return; }
    // Só permite navegar nas pastas que estão vinculadas ao cliente editado.
    if (!clienteEditando || !galeriasDe(clienteEditando.id).some((g) => g.id === id)) return;
    setCarregandoGaleria(true); setErroGaleria(""); setImagensGaleria([]);
    const prefixo = uid + "/" + id + "/thumbs";
    try {
      const { data: arquivos, error } = await supabase.storage.from("fotos").list(prefixo, {
        limit: 36,
        sortBy: { column: "created_at", order: "desc" }
      });
      if (error) throw error;
      const caminhos = (arquivos || []).filter((a) => a.name && /\.(?:webp|jpg|jpeg|png)$/i.test(a.name))
        .map((a) => prefixo + "/" + a.name);
      if (!caminhos.length) { setErroGaleria("Nenhuma miniatura disponível nesta pasta."); return; }
      const { data: urls, error: signedError } = await supabase.storage.from("fotos").createSignedUrls(caminhos, 900);
      if (signedError) throw signedError;
      const imagens = (urls || []).flatMap((item, index) => item.signedUrl ? [{ path: caminhos[index], url: item.signedUrl }] : []);
      setImagensGaleria(imagens);
      if (!imagens.length) setErroGaleria("Não foi possível abrir as fotos desta pasta.");
    } catch {
      setErroGaleria("Não foi possível carregar as fotos. Tente outra pasta.");
    } finally { setCarregandoGaleria(false); }
  }
  async function selecionarFotoDaGaleria(path: string) {
    if (!clienteEditando || !galeriasDe(clienteEditando.id).some((g) => path.startsWith(uid + "/" + g.id + "/thumbs/"))) return;
    setCarregandoGaleria(true); setErroGaleria("");
    try {
      const { data, error } = await supabase.storage.from("fotos").download(path);
      if (error || !data) throw new Error("Download indisponível");
      const mime = /\.webp$/i.test(path) ? "image/webp" : /\.png$/i.test(path) ? "image/png" : "image/jpeg";
      const file = new File([data], "fotura-galeria." + mime.split("/")[1], { type: mime });
      if (file.size > 8 * 1024 * 1024) throw new Error("Arquivo acima do limite");
      escolherFoto(file);
      setGaleriaPicker(false);
    } catch {
      setErroGaleria("Não foi possível escolher esta foto. Tente outra imagem.");
    } finally { setCarregandoGaleria(false); }
  }
  async function assinarAvatar(path: string) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (data?.signedUrl) setSignedAvatars((current) => ({ ...current, [path]: data.signedUrl }));
  }

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uid || !editor || salvando) return;
    const nome = form.nome.trim();
    if (nome.length < 2 || nome.length > 120) { setErroForm("Informe um nome de 2 a 120 caracteres."); return; }
    if (form.observacoes.length > 2000) { setErroForm("As observações devem ter até 2.000 caracteres."); return; }
    if (duplicado && !permitirDuplicado) { setErroForm("Revise o cliente semelhante antes de continuar."); return; }
    setSalvando(true); setErroForm("");
    const previous = clienteEditando;
    const dados = {
      nome, email: form.email.trim() || null, telefone: form.telefone.trim() || null,
      observacoes: form.observacoes.trim(), etiquetas: parseTags(form.etiquetas)
    };
    try {
      const result = previous
        ? await supabase.from("clientes").update(dados).eq("id", previous.id).eq("user_id", uid).select("id,nome,email,telefone,criado_em,avatar_path,observacoes,etiquetas").single()
        : await supabase.from("clientes").insert({ ...dados, user_id: uid }).select("id,nome,email,telefone,criado_em,avatar_path,observacoes,etiquetas").single();
      if (result.error || !result.data) throw new Error("Não foi possível salvar o cliente. Tente novamente.");
      let salvo = result.data as Cliente;
      let avisoFoto = "";
      if (imagem) {
        let caminhoNovo = "";
        try {
          const blob = await recortarAvatar(imagem, zoom, posX, posY);
          caminhoNovo = uid + "/" + salvo.id + "/" + crypto.randomUUID() + ".webp";
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(caminhoNovo, blob, { contentType: "image/webp", cacheControl: "3600", upsert: false });
          if (uploadError) throw uploadError;
          const { data: alterado, error: saveError } = await supabase.from("clientes")
            .update({ avatar_path: caminhoNovo }).eq("id", salvo.id).eq("user_id", uid)
            .select("id,nome,email,telefone,criado_em,avatar_path,observacoes,etiquetas").single();
          if (saveError || !alterado) throw new Error("Falha ao vincular a foto.");
          salvo = alterado as Cliente;
          await assinarAvatar(caminhoNovo);
          if (previous?.avatar_path && previous.avatar_path !== caminhoNovo) {
            void supabase.storage.from(BUCKET).remove([previous.avatar_path]);
          }
        } catch {
          if (caminhoNovo) void supabase.storage.from(BUCKET).remove([caminhoNovo]);
          avisoFoto = " Os dados foram salvos, mas não foi possível atualizar a foto. Tente novamente na edição.";
        }
      } else if (removerFoto && previous?.avatar_path) {
        const { data: alterado, error } = await supabase.from("clientes")
          .update({ avatar_path: null }).eq("id", salvo.id).eq("user_id", uid)
          .select("id,nome,email,telefone,criado_em,avatar_path,observacoes,etiquetas").single();
        if (!error && alterado) {
          salvo = alterado as Cliente;
          void supabase.storage.from(BUCKET).remove([previous.avatar_path]);
        } else avisoFoto = " Os dados foram salvos, mas não foi possível remover a foto.";
      }
      setClientes((current) => [...current.filter((c) => c.id !== salvo.id), salvo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setAviso((previous ? "Cliente atualizado." : "Cliente cadastrado.") + avisoFoto);
      setAvisoErro(Boolean(avisoFoto));
      setEditor(null);
      setSelecionado(salvo.id);
      setAba("resumo");
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : "Não foi possível salvar o cliente.");
    } finally { setSalvando(false); }
  }
  async function excluir() {
    if (!clienteSelecionado || excluindo) return;
    setExcluindo(true);
    const alvo = clienteSelecionado;
    const { error } = await supabase.from("clientes").delete().eq("id", alvo.id).eq("user_id", uid);
    if (error) {
      setAviso("Não foi possível excluir o cliente."); setAvisoErro(true);
    } else {
      setClientes((current) => current.filter((c) => c.id !== alvo.id));
      setProjetos((current) => current.map((p) => p.cliente_id === alvo.id ? { ...p, cliente_id: null } : p));
      setGalerias((current) => current.map((g) => g.cliente_id === alvo.id ? { ...g, cliente_id: null } : g));
      if (alvo.avatar_path) void supabase.storage.from(BUCKET).remove([alvo.avatar_path]);
      setSelecionado(null);
      setConfirmarExclusao(false);
      setAviso("Cliente excluído. Os projetos e galerias foram preservados.");
      setAvisoErro(false);
    }
    setExcluindo(false);
  }

  function abrirDetalhe(id: string) {
    setSelecionado(id);
    setAba("resumo");
    setConfirmarExclusao(false);
  }
  function abrirProjeto(id: string) {
    setSelecionado(null);
    router.push("/dashboard/projetos/" + encodeURIComponent(id));
  }
  function abrirGaleria(g: Galeria) {
    setSelecionado(null);
    router.push(g.projeto_id ? "/dashboard/projetos/" + encodeURIComponent(g.projeto_id) : "/dashboard/entrega/" + encodeURIComponent(g.id));
  }

  const projetosDoSelecionado = clienteSelecionado ? projetosDe(clienteSelecionado.id) : [];
  const galeriasDoSelecionado = clienteSelecionado ? galeriasDe(clienteSelecionado.id) : [];
  const historico = useMemo(() => {
    const events: { at: string; label: string; detail: string }[] = [];
    projetosDoSelecionado.forEach((p) => { if (p.criado_em) events.push({ at: p.criado_em, label: "Projeto criado", detail: p.nome }); });
    galeriasDoSelecionado.forEach((g) => {
      if (g.criado_em) events.push({ at: g.criado_em, label: "Pasta criada", detail: g.titulo });
      if (g.entrega_publicada_em) events.push({ at: g.entrega_publicada_em, label: "Entrega publicada", detail: g.titulo });
      const s = selecoes[g.id];
      if (s?.finalizada && s.atualizado_em) events.push({ at: s.atualizado_em, label: "Seleção finalizada", detail: g.titulo });
    });
    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [projetosDoSelecionado, galeriasDoSelecionado, selecoes]);

  return (
    <main className="dash mf-shift ftc-page">
      <MenuFotografo />
      <div className="ftc-shell">
        <header className="ftc-head">
          <div className="ftc-kicker">CLIENTES</div>
          <h1 className="ftc-title">Sua base de clientes</h1>
          <p className="ftc-description">Pessoas, contatos e trabalhos reunidos em um só lugar.</p>
        </header>
        <section className="ftc-stats" aria-label="Resumo dos clientes">
          <div className="ftc-stat"><b>{clientes.length}</b><span>Clientes cadastrados</span></div>
          <div className="ftc-stat"><b>{comProjetos}</b><span>Com projetos ou galerias</span></div>
          <div className="ftc-stat"><b>{aguardando}</b><span>Aguardando seleção</span></div>
        </section>
        <div className="ftc-toolbar">
          <label className="ftc-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail, telefone ou etiqueta" aria-label="Buscar clientes" />
          </label>
          <select className="ftc-select" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtrar clientes">
            <option value="todos">Todos os clientes</option>
            <option value="com">Com trabalhos</option>
            <option value="sem">Sem trabalhos</option>
            <option value="aguardando">Aguardando seleção</option>
            <option value="entregues">Com entregas</option>
          </select>
          <button type="button" className="ftc-primary" onClick={abrirNovo}>+ Novo cliente</button>
        </div>
        {aviso && <div role={avisoErro ? "alert" : "status"} className={avisoErro ? "ftc-alert" : "ftc-notice"}>{aviso}</div>}
        {carregando ? <div className="ftc-empty">Carregando seus clientes…</div> :
          filtrados.length === 0 ?
            <div className="ftc-empty">
              <strong>{clientes.length ? "Nenhum cliente corresponde à busca." : "Sua base de clientes começa aqui."}</strong>
              <p>{clientes.length ? "Experimente outro filtro ou termo de pesquisa." : "Cadastre seu primeiro cliente para organizar contatos, projetos e entregas."}</p>
              {!clientes.length && <button type="button" className="ftc-primary" onClick={abrirNovo}>+ Cadastrar cliente</button>}
            </div> :
            <section className="ftc-list" aria-label="Clientes cadastrados">
              {filtrados.map((c) => {
                const qtdProjetos = projetosDe(c.id).length;
                const qtdGalerias = galeriasDe(c.id).length;
                return (
                  <article className="ftc-card" key={c.id}>
                    <button type="button" className="ftc-card-main" onClick={() => abrirDetalhe(c.id)} aria-label={"Abrir ficha de " + c.nome}>
                      <CampoAvatar cliente={c} url={c.avatar_path ? signedAvatars[c.avatar_path] : undefined} />
                      <div className="ftc-person">
                        <strong>{c.nome}</strong>
                        <small>{c.email || c.telefone || "Contato não informado"}</small>
                        {!!c.etiquetas?.length && <div className="ftc-tags">{c.etiquetas.slice(0, 3).map((tag) => <span className="ftc-tag" key={tag}>{tag}</span>)}</div>}
                      </div>
                    </button>
                    <div className="ftc-card-meta">
                      <span className="ftc-work">{qtdProjetos} {qtdProjetos === 1 ? "projeto" : "projetos"} · {qtdGalerias} {qtdGalerias === 1 ? "pasta" : "pastas"}</span>
                      <button type="button" className="ftc-close" onClick={() => abrirDetalhe(c.id)} aria-label={"Ver " + c.nome}>›</button>
                    </div>
                  </article>
                );
              })}
            </section>}
      </div>

      {clienteSelecionado && !editor && (
        <div className="ftc-backdrop" onClick={() => !excluindo && setSelecionado(null)}>
          <aside className="ftc-drawer" role="dialog" aria-modal="true" aria-label={"Ficha de " + clienteSelecionado.nome} onClick={(e) => e.stopPropagation()}>
            <div className="ftc-panel-top">
              <div><strong>Ficha do cliente</strong><p>Contatos e trabalhos relacionados</p></div>
              <button type="button" className="ftc-close" aria-label="Fechar ficha" onClick={() => setSelecionado(null)}>×</button>
            </div>
            <div className="ftc-drawer-body">
              <div className="ftc-detail-person">
                <CampoAvatar cliente={clienteSelecionado} url={clienteSelecionado.avatar_path ? signedAvatars[clienteSelecionado.avatar_path] : undefined} size="large" />
                <div><h2>{clienteSelecionado.nome}</h2><p>Cliente desde {dataCurta(clienteSelecionado.criado_em)}</p></div>
              </div>
              <div className="ftc-detail-actions">
                <button type="button" className="ftc-primary" onClick={() => abrirEditor(clienteSelecionado)}>Editar cliente</button>
                <button type="button" className="ftc-secondary" onClick={() => { setSelecionado(null); router.push("/dashboard/projetos?novo=1&cliente=" + encodeURIComponent(clienteSelecionado.id)); }}>+ Criar projeto</button>
                <button type="button" className="ftc-secondary ftc-danger" onClick={() => setConfirmarExclusao(true)}>Excluir</button>
              </div>
              {confirmarExclusao && <div className="ftc-delete-confirm">
                <p>Excluir <strong>{clienteSelecionado.nome}</strong>? Os projetos e as galerias continuarão existindo, mas sem vínculo com este cliente.</p>
                <div className="ftc-detail-actions">
                  <button type="button" className="ftc-secondary" onClick={() => setConfirmarExclusao(false)} disabled={excluindo}>Cancelar</button>
                  <button type="button" className="ftc-secondary ftc-danger" onClick={() => void excluir()} disabled={excluindo}>{excluindo ? "Excluindo..." : "Confirmar exclusão"}</button>
                </div>
              </div>}
              <div className="ftc-tabbar" role="tablist" aria-label="Seções da ficha">
                {([["resumo", "Resumo"], ["trabalhos", "Projetos e galerias"], ["historico", "Histórico"]] as [Aba, string][]).map(([valor, rotulo]) => (
                  <button key={valor} type="button" role="tab" aria-selected={aba === valor} onClick={() => setAba(valor)}>{rotulo}</button>
                ))}
              </div>
              {aba === "resumo" && (
                <div>
                  <section className="ftc-block">
                    <h3>Contato</h3>
                    <div className="ftc-detail-field"><b>E-mail</b>{clienteSelecionado.email ? <a href={"mailto:" + clienteSelecionado.email}>{clienteSelecionado.email}</a> : "Não informado"}</div>
                    <div className="ftc-detail-field"><b>Telefone / WhatsApp</b>{clienteSelecionado.telefone ? (urlWhatsApp(clienteSelecionado.telefone) ? <a href={urlWhatsApp(clienteSelecionado.telefone) || undefined} target="_blank" rel="noopener noreferrer">{clienteSelecionado.telefone} · Conversar no WhatsApp</a> : clienteSelecionado.telefone) : "Não informado"}</div>
                  </section>
                  <section className="ftc-block">
                    <h3>Observações privadas</h3>
                    <div className="ftc-detail-field">{clienteSelecionado.observacoes || "Nenhuma observação adicionada."}</div>
                  </section>
                  <section className="ftc-block">
                    <h3>Etiquetas</h3>
                    {clienteSelecionado.etiquetas?.length ? <div className="ftc-tags">{clienteSelecionado.etiquetas.map((tag) => <span className="ftc-tag" key={tag}>{tag}</span>)}</div> : <p className="ftc-muted">Nenhuma etiqueta adicionada.</p>}
                  </section>
                  <section className="ftc-block">
                    <h3>Trabalhos vinculados</h3>
                    <div className="ftc-detail-field">{projetosDoSelecionado.length} projetos · {galeriasDoSelecionado.length} pastas de fotos</div>
                  </section>
                </div>
              )}
              {aba === "trabalhos" && (
                <div>
                  <section className="ftc-block">
                    <h3>Projetos ({projetosDoSelecionado.length})</h3>
                    {!projetosDoSelecionado.length && <p className="ftc-muted">Nenhum projeto vinculado a este cliente.</p>}
                    {projetosDoSelecionado.map((p) => (
                      <button key={p.id} type="button" className="ftc-work-item" onClick={() => abrirProjeto(p.id)}>
                        <div><strong>{p.nome}</strong><small>Atualizado em {dataCurta(p.atualizado_em)}</small></div><span>›</span>
                      </button>
                    ))}
                  </section>
                  <section className="ftc-block">
                    <h3>Pastas de fotos ({galeriasDoSelecionado.length})</h3>
                    {!galeriasDoSelecionado.length && <p className="ftc-muted">Nenhuma pasta vinculada.</p>}
                    {galeriasDoSelecionado.map((g) => (
                      <button key={g.id} type="button" className="ftc-work-item" onClick={() => abrirGaleria(g)}>
                        <div><strong>{g.titulo}</strong><small>{resumoEtapa(g, selecoes)} · {dataCurta(g.criado_em)}</small></div><span>›</span>
                      </button>
                    ))}
                  </section>
                </div>
              )}
              {aba === "historico" && (
                <section className="ftc-block">
                  <h3>Atividades registradas</h3>
                  {!historico.length && <p className="ftc-muted">O histórico aparecerá quando houver projetos, seleções ou entregas relacionadas ao cliente.</p>}
                  {historico.map((event, index) => (
                    <div className="ftc-event" key={event.at + event.label + index}>
                      <span className="ftc-event-dot" aria-hidden="true" />
                      <div><strong>{event.label}</strong><p>{event.detail} · {dataCurta(event.at)}</p></div>
                    </div>
                  ))}
                  <p className="ftc-muted">O histórico mostra apenas eventos registrados pelo Fotura.</p>
                </section>
              )}
            </div>
          </aside>
        </div>
      )}

      {editor && (
        <div className="ftc-backdrop ftc-editor-backdrop" onClick={() => !salvando && setEditor(null)}>
          <div className="ftc-dialog" role="dialog" aria-modal="true" aria-label={editor === "novo" ? "Cadastrar cliente" : "Editar cliente"} onClick={(e) => e.stopPropagation()}>
            <div className="ftc-panel-top">
              <div><strong>{editor === "novo" ? "Novo cliente" : "Editar cliente"}</strong><p>Dados essenciais e apresentação do contato</p></div>
              <button type="button" className="ftc-close" aria-label="Fechar cadastro" disabled={salvando} onClick={() => setEditor(null)}>×</button>
            </div>
            <form onSubmit={(e) => void salvar(e)} className="ftc-dialog-body">
              <div className="ftc-form-photo">
                <div className="ftc-photo-preview" aria-hidden="true">
                  {preview ? <img src={preview} alt="" style={{ objectPosition: String(posX) + "% " + String(posY) + "%", transform: "scale(" + zoom + ")" }} /> :
                    clienteEditando?.avatar_path && !removerFoto && signedAvatars[clienteEditando.avatar_path] ? <img alt="" src={signedAvatars[clienteEditando.avatar_path]} /> : iniciais(form.nome || "Cliente")}
                </div>
                <div className="ftc-photo-controls">
                  <p>Foto do cliente (opcional). Só você pode visualizar a imagem no Fotura.</p>
                  <div className="ftc-photo-actions">
                    <label className="ftc-file-label">Escolher foto <input type="file" accept="image/jpeg,image/png,image/webp" disabled={salvando} onChange={(e) => escolherFoto(e.target.files?.[0])} /></label>
                    {!!clienteEditando && galeriasDe(clienteEditando.id).length > 0 && <button type="button" className="ftc-secondary" disabled={salvando} onClick={() => setGaleriaPicker((open) => !open)}>Escolher da galeria</button>}
                    {(imagem || (clienteEditando?.avatar_path && !removerFoto)) && <button type="button" className="ftc-secondary ftc-danger" disabled={salvando} onClick={() => { setImagem(null); setRemoverFoto(true); }}>Remover foto</button>}
                  </div>
                </div>
              </div>
              {galeriaPicker && !!clienteEditando && (
                <div className="ftc-gallery-picker">
                  <p>Escolha uma pasta vinculada a este cliente e depois uma fotografia. A imagem será copiada para o cadastro privado.</p>
                  <select aria-label="Escolher pasta do cliente" value={galeriaId} onChange={(e) => { setGaleriaId(e.target.value); void carregarFotosDaGaleria(e.target.value); }}>
                    <option value="">Selecione uma pasta</option>
                    {galeriasDe(clienteEditando.id).map((g) => <option key={g.id} value={g.id}>{g.titulo}</option>)}
                  </select>
                  {carregandoGaleria && <p>Carregando fotografias…</p>}
                  {erroGaleria && <p role="alert">{erroGaleria}</p>}
                  {!!imagensGaleria.length && <div className="ftc-gallery-thumbs">
                    {imagensGaleria.map((item) => (
                      <button type="button" key={item.path} disabled={carregandoGaleria || salvando} title="Usar esta fotografia" aria-label="Usar foto da galeria como avatar" onClick={() => void selecionarFotoDaGaleria(item.path)}>
                        <img alt="" src={item.url} loading="lazy" />
                      </button>
                    ))}
                  </div>}
                </div>
              )}
              {!!imagem && (
                <div className="ftc-crop">
                  <div className="ftc-muted">Ajuste o enquadramento. O recorte será salvo em formato quadrado.</div>
                  <label>Zoom <input type="range" min="1" max="2.5" step=".05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
                  <label>Horizontal <input type="range" min="0" max="100" value={posX} onChange={(e) => setPosX(Number(e.target.value))} /></label>
                  <label>Vertical <input type="range" min="0" max="100" value={posY} onChange={(e) => setPosY(Number(e.target.value))} /></label>
                </div>
              )}
              <label className="ftc-field"><span>Nome *</span><input required autoFocus maxLength={120} value={form.nome} disabled={salvando} onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))} placeholder="Nome do cliente" /></label>
              <div className="ftc-form-row">
                <label className="ftc-field"><span>E-mail</span><input type="email" maxLength={254} value={form.email} disabled={salvando} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} placeholder="cliente@email.com" /></label>
                <label className="ftc-field"><span>Telefone / WhatsApp</span><input type="tel" maxLength={30} value={form.telefone} disabled={salvando} onChange={(e) => setForm((current) => ({ ...current, telefone: e.target.value }))} placeholder="(00) 00000-0000" /></label>
              </div>
              {duplicado && <div className="ftc-warning">
                Já existe um cadastro semelhante: <b>{duplicado.nome}</b>. Confira antes de criar ou salvar.
                <div style={{ marginTop: 8 }}><button className="ftc-secondary" type="button" onClick={() => { setEditor(null); abrirDetalhe(duplicado.id); }}>Abrir cadastro existente</button></div>
                <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, cursor: "pointer" }}><input type="checkbox" checked={permitirDuplicado} onChange={(e) => setPermitirDuplicado(e.target.checked)} /> Manter mesmo e-mail ou telefone intencionalmente</label>
              </div>}
              <label className="ftc-field"><span>Etiquetas (opcional)</span><input maxLength={250} value={form.etiquetas} disabled={salvando} onChange={(e) => setForm((current) => ({ ...current, etiquetas: e.target.value }))} placeholder="Casamento, Família, Recorrente" /></label>
              <p className="ftc-tags-small">Separe por vírgulas, até 8 etiquetas.</p>
              <label className="ftc-field"><span>Observações privadas</span><textarea maxLength={2000} value={form.observacoes} disabled={salvando} onChange={(e) => setForm((current) => ({ ...current, observacoes: e.target.value }))} placeholder="Preferências, observações de atendimento, detalhes úteis..." /></label>
              {erroForm && <div className="ftc-alert" role="alert">{erroForm}</div>}
              <div className="ftc-form-foot">
                <button type="button" className="ftc-secondary" disabled={salvando} onClick={() => setEditor(null)}>Cancelar</button>
                <button type="submit" className="ftc-primary" disabled={salvando || !form.nome.trim() || !!(duplicado && !permitirDuplicado)}>{salvando ? "Salvando..." : editor === "novo" ? "Cadastrar cliente" : "Salvar alterações"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
