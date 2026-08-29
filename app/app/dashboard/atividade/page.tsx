"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase-client";
import MenuFotografo from "../../MenuFotografo";

type Atividade = {
  id: number;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  ator: "fotografo" | "cliente" | "sistema";
  detalhes: { titulo?: string; nome?: string; campos?: string[]; fotos?: number } | null;
  criado_em: string;
};

type Filtro = "todas" | "galeria" | "cliente" | "selecao";

const ROTULOS: Record<string, string> = {
  galeria_criada: "Galeria criada",
  galeria_atualizada: "Galeria atualizada",
  galeria_excluida: "Galeria excluída",
  cliente_criado: "Cliente cadastrado",
  cliente_atualizado: "Cliente atualizado",
  cliente_excluido: "Cliente excluído",
  selecao_finalizada: "Seleção finalizada",
};

const CAMPOS: Record<string, string> = {
  titulo: "título",
  capa: "capa",
  prova: "modo prova",
  limite: "limite de seleção",
  prazo: "prazo",
  link_ate: "validade do link",
  senha: "senha",
  cliente: "cliente vinculado",
  storage: "armazenamento",
  nome: "nome",
  email: "e-mail",
  telefone: "telefone",
};

export default function AtividadePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [itens, setItens] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      const { data, error } = await supabase
        .from("atividade_auditoria")
        .select("id,acao,entidade,entidade_id,ator,detalhes,criado_em")
        .order("criado_em", { ascending: false })
        .limit(200);
      if (!ativo) return;
      if (error) {
        setErro("Não foi possível carregar o histórico de atividade agora.");
        setCarregando(false);
        return;
      }
      setItens((data ?? []) as Atividade[]);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (filtro !== "todas" && item.entidade !== filtro) return false;
      if (!q) return true;
      const alvo = [ROTULOS[item.acao] ?? item.acao, item.detalhes?.titulo, item.detalhes?.nome, item.ator]
        .filter(Boolean).join(" ").toLowerCase();
      return alvo.includes(q);
    });
  }, [busca, filtro, itens]);

  function relativo(iso: string) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `há ${d} dia${d === 1 ? "" : "s"}`;
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  }

  function descricao(item: Atividade) {
    const nome = item.detalhes?.titulo || item.detalhes?.nome;
    if (item.acao === "selecao_finalizada") {
      const qtd = item.detalhes?.fotos ?? 0;
      return `${nome || "Galeria"} · ${qtd} foto${qtd === 1 ? "" : "s"} selecionada${qtd === 1 ? "" : "s"}`;
    }
    const campos = item.detalhes?.campos ?? [];
    if (campos.length) {
      return `${nome || "Item"} · ${campos.map((c) => CAMPOS[c] ?? c).join(", ")}`;
    }
    return nome || (item.entidade === "cliente" ? "Cliente" : "Galeria");
  }

  function ator(item: Atividade) {
    if (item.ator === "fotografo") return "Você";
    if (item.ator === "cliente") return "Cliente";
    return "Fotura";
  }

  function abrir(item: Atividade) {
    if (!item.entidade_id) return;
    if (item.entidade === "selecao") router.push(`/dashboard/selecoes?galeria=${item.entidade_id}`);
    else if (item.entidade === "galeria" && item.acao !== "galeria_excluida") router.push("/dashboard/galerias");
    else if (item.entidade === "cliente" && item.acao !== "cliente_excluido") router.push("/dashboard/clientes");
  }

  return <main className="dash mf-shift">
    <MenuFotografo />
    <style>{`
      .dash{min-height:100vh;background:linear-gradient(180deg,#0b0b1a 0%,#101024 100%);color:#f0f0f5}.body{max-width:1120px;margin:auto;padding:40px 40px 80px}.top{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:24px}.ey{font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6f76a0}.h1{font-size:30px;margin:7px 0 0}.sub{font-size:13px;color:#7a7f9a;margin-top:6px}.tools{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.search{width:260px;padding:10px 12px;border:1px solid #2a2d40;border-radius:10px;background:#0f0f1a;color:#f0f0f5;font:13px inherit}.tabs{display:flex;gap:5px}.tab{border:1px solid #2a2d40;border-radius:9px;background:#111124;color:#9ba1b8;padding:9px 11px;font:600 11px inherit;cursor:pointer}.tab.on{color:#fff;background:linear-gradient(90deg,rgba(17,150,252,.16),rgba(93,13,250,.09));border-color:rgba(74,108,247,.35)}.card{background:linear-gradient(180deg,#14142b,#101023);border:1px solid #23233c;border-radius:16px;padding:8px 20px}.row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:14px;align-items:center;padding:16px 2px;border-bottom:1px solid #202238}.row:last-child{border-bottom:0}.icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:#18182f;border:1px solid #282a43;color:#9fb0ff;font-size:16px}.title{font-size:13px;font-weight:650;color:#eef0f7}.meta{font-size:11px;color:#747a96;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.right{text-align:right}.time{font-size:10px;color:#717791}.actor{font-size:9px;color:#555c78;margin-top:5px;text-transform:uppercase;letter-spacing:.7px}.click{cursor:pointer}.click:hover .title{color:#aebdff}.empty{padding:48px 16px;text-align:center;color:#6f76a0;font-size:13px}.error{margin-bottom:16px;padding:13px 15px;border:1px solid rgba(239,68,68,.25);background:rgba(239,68,68,.07);border-radius:12px;color:#ff9d9d;font-size:13px}@media(max-width:760px){.body{padding:76px 18px 60px}.top{align-items:flex-start;flex-direction:column}.tools{width:100%}.search{width:100%}.tabs{width:100%;overflow:auto}.row{grid-template-columns:38px minmax(0,1fr)}.right{grid-column:2;text-align:left;display:flex;gap:8px;align-items:center}.icon{width:34px;height:34px}.h1{font-size:25px}}
    `}</style>
    <div className="body">
      <header className="top">
        <div><div className="ey">ATIVIDADE</div><h1 className="h1">Histórico da conta</h1><div className="sub">Acompanhe alterações importantes em galerias, clientes e seleções.</div></div>
        <div className="tools"><input className="search" value={busca} onChange={(e)=>setBusca(e.target.value)} placeholder="Buscar no histórico"/><div className="tabs">{(["todas","galeria","cliente","selecao"] as Filtro[]).map((f)=><button type="button" key={f} className={"tab"+(filtro===f?" on":"")} onClick={()=>setFiltro(f)}>{f==="todas"?"Todas":f==="galeria"?"Galerias":f==="cliente"?"Clientes":"Seleções"}</button>)}</div></div>
      </header>
      {erro&&<div className="error">{erro}</div>}
      <section className="card">
        {carregando?<div className="empty">Carregando atividade…</div>:filtrados.length===0?<div className="empty">{itens.length?"Nenhum evento encontrado para este filtro.":"As próximas ações importantes aparecerão aqui."}</div>:filtrados.map((item)=>{
          const navegavel=(item.entidade==="selecao")||(item.entidade==="galeria"&&item.acao!=="galeria_excluida")||(item.entidade==="cliente"&&item.acao!=="cliente_excluido");
          const simbolo=item.entidade==="galeria"?"▣":item.entidade==="cliente"?"○":"✓";
          return <article key={item.id} className={"row"+(navegavel?" click":"")} onClick={()=>navegavel&&abrir(item)} role={navegavel?"button":undefined} tabIndex={navegavel?0:undefined} onKeyDown={(e)=>{if(navegavel&&(e.key==="Enter"||e.key===" "))abrir(item)}}><div className="icon" aria-hidden="true">{simbolo}</div><div><div className="title">{ROTULOS[item.acao] ?? "Atividade registrada"}</div><div className="meta">{descricao(item)}</div></div><div className="right"><div className="time">{relativo(item.criado_em)}</div><div className="actor">{ator(item)}</div></div></article>
        })}
      </section>
    </div>
  </main>;
}
