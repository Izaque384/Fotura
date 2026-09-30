"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MenuFotografo from "../MenuFotografo";
import { createClient } from "../../lib/supabase-client";

type Tipo = "problema" | "sugestao" | "feedback";
type Categoria = "galerias" | "clientes" | "selecoes" | "vendas" | "planos" | "perfil" | "conta" | "outro";

const categorias: Array<{ value: Categoria; label: string }> = [
  { value: "galerias", label: "Galerias" },
  { value: "clientes", label: "Clientes" },
  { value: "selecoes", label: "Seleções" },
  { value: "vendas", label: "Vendas" },
  { value: "planos", label: "Planos e cobrança" },
  { value: "perfil", label: "Perfil e apresentação" },
  { value: "conta", label: "Conta e acesso" },
  { value: "outro", label: "Outro" },
];

const faq = [
  { pergunta: "Qual a diferença entre prova e entrega?", resposta: "A prova é usada quando o cliente ainda precisa selecionar fotos. A entrega é a galeria final, preparada para visualização e download das imagens entregues." },
  { pergunta: "Como compartilho uma galeria?", resposta: "Em Galerias, use a ação Compartilhar. Você pode copiar o link ou enviar pelo WhatsApp ou e-mail quando o cliente tiver os dados de contato necessários." },
  { pergunta: "Como funciona a seleção do cliente?", resposta: "Em uma galeria de prova, o cliente marca as fotos desejadas e pode finalizar a seleção. O resultado aparece em Seleções para você continuar o fluxo." },
  { pergunta: "Onde altero a capa e o visual da galeria?", resposta: "A capa é escolhida em Galerias → Gerenciar galeria → Alterar capa. Os recursos gerais de apresentação do estúdio ficam no Perfil." },
  { pergunta: "Como funciona o armazenamento?", resposta: "O uso de armazenamento segue o limite do seu plano. Você pode acompanhar o consumo e os limites na área Planos." },
  { pergunta: "O que acontece quando o link expira?", resposta: "A galeria deixa de ficar disponível para o cliente, mas não é apagada automaticamente. Você continua no controle do conteúdo dentro da sua conta." },
  { pergunta: "Como vendo fotos extras?", resposta: "Quando a venda de extras estiver habilitada para a galeria, o cliente pode comprar fotos além da quantidade incluída. As vendas aparecem na área Vendas." },
];

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
}
function BugIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 4h6M10 2l1 2m3-2-1 2M7 9H4m16 0h-3M7 14H4m16 0h-3"/><rect x="7" y="6" width="10" height="13" rx="5"/><path d="M12 9v7"/></svg>;
}
function IdeaIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18h6M10 21h4"/><path d="M8.3 15.3A7 7 0 1 1 15.7 15.3c-.8.6-1.2 1.2-1.4 2.2h-4.6c-.2-1-.6-1.6-1.4-2.2Z"/></svg>;
}
function HeartIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 5.7c-1.9-2-5-2-6.9 0L12 7.6l-1.9-1.9c-1.9-2-5-2-6.9 0-2 2.1-1.8 5.4.3 7.3L12 21l8.5-8c2.1-1.9 2.3-5.2.3-7.3Z"/></svg>;
}
function HelpIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.7 1.8c-.9.6-1.5 1-1.5 2.2"/><path d="M12 17h.01"/></svg>;
}
function ImageIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m5 17 4-4 3 3 2-2 5 4"/></svg>;
}
function StarIcon({ preenchida }: { preenchida: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={preenchida ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/></svg>;
}

const tipoInfo: Record<Tipo, { titulo: string; subtitulo: string }> = {
  problema: { titulo: "Reportar problema", subtitulo: "Algo não funcionou como esperado" },
  sugestao: { titulo: "Enviar sugestão", subtitulo: "Uma ideia para melhorar o Fotura" },
  feedback: { titulo: "Dar feedback", subtitulo: "Conte como está sua experiência" },
};

export default function AjudaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const formularioRef = useRef<HTMLElement>(null);
  const [tipo, setTipo] = useState<Tipo>("problema");
  const [categoria, setCategoria] = useState<Categoria>("galerias");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [nota, setNota] = useState<number | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [origem, setOrigem] = useState("/ajuda");
  const [buscaFaq, setBuscaFaq] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState(false);

  const faqFiltrada = useMemo(() => {
    const termo = buscaFaq.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return faq;
    return faq.filter(item => `${item.pergunta} ${item.resposta}`.toLocaleLowerCase("pt-BR").includes(termo));
  }, [buscaFaq]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const valor = query.get("origem");
    if (valor?.startsWith("/") && valor.length <= 500) setOrigem(valor);
  }, []);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (ativo && !data.session) router.replace("/login");
    })();
    return () => { ativo = false; };
  }, [router, supabase]);

  function trocarTipo(novo: Tipo) {
    setTipo(novo);
    setAviso("");
    setErro(false);
    if (novo !== "feedback") setNota(null);
    if (novo !== "problema") {
      setArquivo(null);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  function abrirSuporte() {
    trocarTipo("problema");
    formularioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selecionarArquivo(file: File | null) {
    if (!file) { setArquivo(null); return; }
    if (file.size > 5 * 1024 * 1024) {
      setErro(true);
      setAviso("A imagem deve ter no máximo 5 MB.");
      if (arquivoRef.current) arquivoRef.current.value = "";
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErro(true);
      setAviso("Envie uma imagem PNG, JPG ou WebP.");
      if (arquivoRef.current) arquivoRef.current.value = "";
      return;
    }
    setArquivo(file);
    setErro(false);
    setAviso("");
  }

  function removerArquivo() {
    setArquivo(null);
    if (arquivoRef.current) arquivoRef.current.value = "";
  }

  async function enviar(event: FormEvent) {
    event.preventDefault();
    if (enviando) return;
    setAviso("");
    setErro(false);

    if (assunto.trim().length < 3) {
      setErro(true); setAviso("Informe um assunto com pelo menos 3 caracteres."); return;
    }
    if (mensagem.trim().length < 10) {
      setErro(true); setAviso("Conte um pouco mais para conseguirmos entender sua mensagem."); return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { router.replace("/login"); return; }

    setEnviando(true);
    try {
      const form = new FormData();
      form.set("tipo", tipo);
      form.set("categoria", categoria);
      form.set("assunto", assunto.trim());
      form.set("mensagem", mensagem.trim());
      form.set("pagina_origem", origem);
      form.set("navegador", navigator.userAgent.slice(0, 500));
      if (tipo === "feedback" && nota) form.set("nota", String(nota));
      if (tipo === "problema" && arquivo) form.set("screenshot", arquivo);

      const resposta = await fetch("/api/feedback", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await resposta.json().catch(() => ({ error: "Não foi possível enviar sua mensagem." })) as { error?: string; mensagem?: string };
      if (!resposta.ok) throw new Error(body.error || "Não foi possível enviar sua mensagem.");

      setAviso(body.mensagem || "Mensagem enviada.");
      setAssunto("");
      setMensagem("");
      setNota(null);
      removerArquivo();
    } catch (error) {
      setErro(true);
      setAviso(error instanceof Error ? error.message : "Não foi possível enviar sua mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  return <main className="help mf-shift">
    <MenuFotografo />
    <style>{`
      .help{min-height:100vh;background:linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%);color:#21253A;padding-top:46px;padding-right:5vw;padding-bottom:80px;box-sizing:border-box;font-family:Sora,sans-serif}
      .help-wrap{max-width:1180px;margin:0 auto}.help-head{margin-bottom:20px}.ey{font-size:11px;letter-spacing:2px;color:#6F76A0;text-transform:uppercase}.h1{font-size:28px;margin:7px 0 4px;letter-spacing:-.45px}.sub{max-width:680px;margin:0;color:#7A7F9A;font-size:13px;line-height:1.55}
      .layout{display:grid;grid-template-columns:minmax(0,1fr) 430px;gap:18px;align-items:start}.card{background:linear-gradient(180deg,#FAF8FD,#F3EFF9);border:1px solid #DCD6EE;border-radius:16px;box-shadow:0 8px 24px rgba(65,52,111,.045)}
      .card-head{display:flex;align-items:flex-start;gap:11px;padding:18px 18px 14px;border-bottom:1px solid #E5E0EC}.card-icon{width:34px;height:34px;display:grid;place-items:center;flex:none;border:1px solid #DAD2E9;border-radius:10px;background:#EEE8FA;color:#655C90}.card-icon svg{width:17px;height:17px}.card-copy{min-width:0}.card-title{margin:0;color:#2A2F46;font-size:15px;font-weight:800}.card-desc{margin:4px 0 0;color:#777D93;font-size:10.5px;line-height:1.5}
      .faq-body{padding:14px}.faq-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.search-box{position:relative;display:flex;align-items:center;flex:1}.search-box svg{position:absolute;left:10px;width:14px;height:14px;color:#747A96;pointer-events:none}.search{width:100%;height:36px;box-sizing:border-box;padding:7px 11px 7px 32px;border:1px solid #D7D0E7;border-radius:9px;background:#F7F4FB;color:#21253A;font-family:inherit;font-size:11px;outline:0}.search:focus{border-color:#B9ADD8;background:#FCFAFE}.search::placeholder{color:#8B8FA2}.result-count{flex:none;color:#8A8EA2;font-size:9px;white-space:nowrap}
      .faq-list{display:grid;gap:8px}.faq-item{border:1px solid #E0DAEA;border-radius:11px;background:#FCFAFE;overflow:hidden;transition:border-color .15s,box-shadow .15s}.faq-item:hover{border-color:#CFC6E3}.faq-item[open]{border-color:#C9BFE0;box-shadow:0 7px 20px rgba(65,52,111,.045)}.faq-item summary{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;list-style:none;padding:12px 13px;color:#454B65;font-size:11px;font-weight:750}.faq-item summary::-webkit-details-marker{display:none}.faq-chevron{width:25px;height:25px;display:grid;place-items:center;flex:none;border:1px solid #E0DAEB;border-radius:7px;background:#F5F1F9;color:#77709A;font-size:15px;line-height:1;transition:transform .15s}.faq-item[open] .faq-chevron{transform:rotate(45deg)}.faq-answer{padding:0 13px 13px;color:#73758D;font-size:10.5px;line-height:1.65}.faq-empty{padding:30px 12px;text-align:center;color:#81859A;font-size:10.5px}
      .support-strip{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;padding:13px 14px;border:1px solid #DED5EC;border-radius:12px;background:#F1EDF8}.support-copy strong{display:block;color:#353B55;font-size:10.5px}.support-copy span{display:block;margin-top:3px;color:#72778D;font-size:9.5px;line-height:1.45}.support-btn{height:32px;flex:none;border:1px solid #D1C8E4;border-radius:9px;background:#FAF8FD;color:#5A527B;padding:0 10px;font:750 9.5px inherit;cursor:pointer}.support-btn:hover{background:#F6F1FA;border-color:#BFB3D9}
      .form-card{position:sticky;top:24px;overflow:hidden}.form-body{padding:14px 16px 16px}.type-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:14px}.type-btn{min-width:0;border:1px solid #DDD6E8;border-radius:10px;background:#F7F4FB;color:#71768B;padding:9px 8px;font-family:inherit;text-align:left;cursor:pointer;transition:border-color .15s,background .15s,transform .15s}.type-btn:hover{border-color:#C8BEE0;background:#F2EDF8}.type-btn.on{border-color:#BFB1E0;background:linear-gradient(135deg,rgba(17,150,252,.09),rgba(93,13,250,.08));color:#474062}.type-line{display:flex;align-items:center;gap:6px}.type-icon{width:24px;height:24px;display:grid;place-items:center;border-radius:7px;background:#EEEAF7;color:#69608F;flex:none}.type-icon svg{width:14px;height:14px}.type-btn.on .type-icon{background:#E5DDF7;color:#5D4A97}.type-label{font-size:9.5px;font-weight:800;line-height:1.2}.type-sub{display:none;margin-top:5px;font-size:8.5px;line-height:1.35;color:#8A8EA1}
      .form{display:grid;gap:11px}.row2{display:grid;grid-template-columns:1fr 1fr;gap:9px}.field{display:grid;gap:5px}.field-label{font-size:9.5px;font-weight:750;color:#5D637B}.input,.select,.textarea{width:100%;box-sizing:border-box;border:1px solid #D7D0E7;border-radius:9px;background:#F7F4FB;color:#252A40;font-family:inherit;font-size:11px;outline:0}.input,.select{height:38px;padding:0 10px}.textarea{min-height:122px;padding:10px 11px;resize:vertical;line-height:1.55}.input:focus,.select:focus,.textarea:focus{border-color:#B9ADD8;background:#FCFAFE;box-shadow:0 0 0 3px rgba(93,13,250,.055)}.input::placeholder,.textarea::placeholder{color:#999BAC}.field-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}.hint{color:#8B8EA0;font-size:8.5px;line-height:1.45}
      .rating{display:flex;gap:5px}.rate{width:34px;height:32px;display:grid;place-items:center;border:1px solid #D8D1E5;border-radius:8px;background:#F7F4FB;color:#A29DAF;cursor:pointer}.rate svg{width:16px;height:16px}.rate:hover,.rate.on{border-color:#BFAFDC;background:#F0EAF8;color:#725EA7}
      .upload{display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px dashed #CFC5DF;border-radius:10px;background:#F8F5FA}.upload-icon{width:32px;height:32px;display:grid;place-items:center;flex:none;border:1px solid #DED6E9;border-radius:9px;background:#F0EBF7;color:#766C99}.upload-icon svg{width:16px;height:16px}.upload-copy{min-width:0;flex:1}.upload-title{font-size:9.5px;font-weight:750;color:#555C74;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.upload-sub{margin-top:2px;color:#8A8EA0;font-size:8.5px}.upload-actions{display:flex;gap:5px;flex:none}.upload-btn,.remove-btn{height:29px;border:1px solid #D7D0E7;border-radius:8px;background:#FAF8FD;color:#5E647A;padding:0 8px;font:700 8.5px inherit;cursor:pointer}.remove-btn{color:#A6535E}.file-hidden{display:none}
      .form-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:4px}.context{display:flex;align-items:center;gap:6px;min-width:0;color:#9295A6;font-size:8.5px}.context-dot{width:6px;height:6px;border-radius:50%;background:#8FA0C9;flex:none}.submit{height:36px;flex:none;border:0;border-radius:9px;background:linear-gradient(90deg,#1196FC,#5D0DFA);color:#fff;padding:0 14px;font:750 10.5px inherit;cursor:pointer;box-shadow:0 7px 15px rgba(93,13,250,.12)}.submit:disabled{opacity:.55;cursor:default;box-shadow:none}.notice{margin-top:12px;padding:10px 12px;border-radius:10px;border:1px solid #CBE4D6;background:#EAF5EF;color:#3F7C5B;font-size:10px;line-height:1.45}.notice.err{border-color:#E7C7CC;background:#FAF0F2;color:#A6535E}
      @media(min-width:1050px){.type-sub{display:block}}
      @media(max-width:980px){.layout{grid-template-columns:1fr}.form-card{position:static}.form-card{order:-1}.type-sub{display:block}}
      @media(max-width:640px){.help{padding-top:76px;padding-right:18px;padding-bottom:60px;padding-left:18px}.h1{font-size:24px}.layout{gap:12px}.card-head{padding:15px}.faq-body,.form-body{padding:12px}.type-grid{grid-template-columns:1fr}.type-sub{display:block}.row2{grid-template-columns:1fr}.support-strip{align-items:flex-start;flex-direction:column}.support-btn{width:100%}.form-footer{align-items:stretch;flex-direction:column}.submit{width:100%}.context{order:2}.upload{align-items:flex-start;flex-wrap:wrap}.upload-actions{width:100%}.upload-btn,.remove-btn{flex:1}}
    `}</style>

    <div className="help-wrap">
      <header className="help-head">
        <div className="ey">AJUDA E FEEDBACK</div>
        <h1 className="h1">Como podemos ajudar?</h1>
        <p className="sub">Encontre respostas rápidas, reporte um problema ou compartilhe uma ideia para melhorar o Fotura.</p>
      </header>

      <div className="layout">
        <section className="card faq-card">
          <div className="card-head">
            <div className="card-icon"><HelpIcon/></div>
            <div className="card-copy">
              <h2 className="card-title">Central de ajuda</h2>
              <p className="card-desc">Respostas para as dúvidas mais comuns do fluxo de trabalho.</p>
            </div>
          </div>
          <div className="faq-body">
            <div className="faq-toolbar">
              <label className="search-box">
                <SearchIcon/>
                <input className="search" aria-label="Buscar na central de ajuda" value={buscaFaq} onChange={e=>setBuscaFaq(e.target.value)} placeholder="Buscar uma dúvida"/>
              </label>
              <span className="result-count">{faqFiltrada.length} {faqFiltrada.length===1?"resposta":"respostas"}</span>
            </div>
            <div className="faq-list">
              {faqFiltrada.map(item => <details className="faq-item" key={item.pergunta}>
                <summary><span>{item.pergunta}</span><span className="faq-chevron" aria-hidden="true">+</span></summary>
                <div className="faq-answer">{item.resposta}</div>
              </details>)}
              {!faqFiltrada.length&&<div className="faq-empty">Nenhuma resposta encontrada. Você pode falar com o suporte pelo formulário ao lado.</div>}
            </div>
            <div className="support-strip">
              <div className="support-copy"><strong>Não encontrou o que precisava?</strong><span>Envie o problema com o máximo de contexto possível. Se necessário, entraremos em contato pelo e-mail da sua conta.</span></div>
              <button type="button" className="support-btn" onClick={abrirSuporte}>Falar com suporte</button>
            </div>
          </div>
        </section>

        <section ref={formularioRef} className="card form-card">
          <div className="card-head">
            <div className="card-icon">{tipo==="problema"?<BugIcon/>:tipo==="sugestao"?<IdeaIcon/>:<HeartIcon/>}</div>
            <div className="card-copy">
              <h2 className="card-title">Enviar uma mensagem</h2>
              <p className="card-desc">Canal voluntário e direto com a equipe do Fotura.</p>
            </div>
          </div>

          <div className="form-body">
            <div className="type-grid" role="tablist" aria-label="Tipo de mensagem">
              {(["problema","sugestao","feedback"] as Tipo[]).map(item=><button
                type="button"
                role="tab"
                aria-selected={tipo===item}
                className={"type-btn"+(tipo===item?" on":"")}
                key={item}
                onClick={()=>trocarTipo(item)}
              >
                <span className="type-line"><span className="type-icon">{item==="problema"?<BugIcon/>:item==="sugestao"?<IdeaIcon/>:<HeartIcon/>}</span><span className="type-label">{tipoInfo[item].titulo}</span></span>
                <span className="type-sub">{tipoInfo[item].subtitulo}</span>
              </button>)}
            </div>

            <form className="form" onSubmit={enviar}>
              <div className="row2">
                <label className="field"><span className="field-label">Categoria</span><select className="select" value={categoria} onChange={e=>setCategoria(e.target.value as Categoria)}>{categorias.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label>
                <label className="field"><span className="field-label">Assunto</span><input className="input" maxLength={120} value={assunto} onChange={e=>setAssunto(e.target.value)} placeholder={tipo==="problema"?"Ex.: erro ao abrir galeria":tipo==="sugestao"?"Ex.: organizar por pastas":"Ex.: minha experiência"}/></label>
              </div>

              {tipo==="feedback"&&<div className="field">
                <span className="field-label">Avaliação opcional</span>
                <div className="rating" aria-label="Avaliação de 1 a 5">
                  {[1,2,3,4,5].map(n=><button type="button" key={n} className={"rate"+(nota!==null&&n<=nota?" on":"")} aria-label={`${n} estrela${n===1?"":"s"}`} aria-pressed={nota===n} onClick={()=>setNota(nota===n?null:n)}><StarIcon preenchida={nota!==null&&n<=nota}/></button>)}
                </div>
              </div>}

              <label className="field">
                <span className="field-label">{tipo==="problema"?"O que aconteceu?":tipo==="sugestao"?"Conte sua ideia":"Como está sua experiência?"}</span>
                <textarea className="textarea" maxLength={3000} value={mensagem} onChange={e=>setMensagem(e.target.value)} placeholder={tipo==="problema"?"Explique o que você estava fazendo, o que esperava e o que aconteceu.":tipo==="sugestao"?"Explique a ideia e como ela ajudaria no seu trabalho.":"Conte o que está funcionando bem e o que poderíamos melhorar."}/>
                <span className="hint">{mensagem.length}/3000</span>
              </label>

              {tipo==="problema"&&<div className="field">
                <span className="field-label">Screenshot opcional</span>
                <input ref={arquivoRef} className="file-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>selecionarArquivo(e.target.files?.[0]??null)}/>
                <div className="upload">
                  <div className="upload-icon"><ImageIcon/></div>
                  <div className="upload-copy">
                    <div className="upload-title">{arquivo?arquivo.name:"Ajude a mostrar o que aconteceu"}</div>
                    <div className="upload-sub">{arquivo?`${(arquivo.size/1024/1024).toFixed(2)} MB · imagem privada`:"PNG, JPG ou WebP · até 5 MB"}</div>
                  </div>
                  <div className="upload-actions">
                    <button type="button" className="upload-btn" onClick={()=>arquivoRef.current?.click()}>{arquivo?"Trocar":"Selecionar imagem"}</button>
                    {arquivo&&<button type="button" className="remove-btn" onClick={removerArquivo}>Remover</button>}
                  </div>
                </div>
              </div>}

              <div className="form-footer">
                <div className="context" title={origem}><span className="context-dot"/><span>Contexto técnico da página incluído automaticamente</span></div>
                <button className="submit" disabled={enviando||assunto.trim().length<3||mensagem.trim().length<10} type="submit">{enviando?"Enviando…":"Enviar mensagem"}</button>
              </div>
            </form>

            {aviso&&<div className={"notice"+(erro?" err":"")} role={erro?"alert":"status"}>{aviso}</div>}
          </div>
        </section>
      </div>
    </div>
  </main>;
}
