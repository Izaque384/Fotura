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
  ["Qual a diferença entre prova e entrega?", "A prova é usada quando o cliente ainda precisa selecionar fotos. A entrega é a galeria final, preparada para visualização e download das imagens entregues."],
  ["Como compartilho uma galeria?", "Em Galerias, use a ação Compartilhar. Você pode copiar o link ou enviar pelo WhatsApp ou e-mail quando o cliente tiver os dados de contato necessários."],
  ["Como funciona a seleção do cliente?", "Em uma galeria de prova, o cliente marca as fotos desejadas e pode finalizar a seleção. O resultado aparece em Seleções para você continuar o fluxo."],
  ["Onde altero a capa e o visual da galeria?", "A capa é escolhida em Galerias → Gerenciar galeria → Alterar capa. Os recursos gerais de apresentação do estúdio ficam no Perfil."],
  ["Como funciona o armazenamento?", "O uso de armazenamento segue o limite do seu plano. Você pode acompanhar o consumo e os limites na área Planos."],
  ["O que acontece quando o link expira?", "A galeria deixa de ficar disponível para o cliente, mas não é apagada automaticamente. Você continua no controle do conteúdo dentro da sua conta."],
  ["Como vendo fotos extras?", "Quando a venda de extras estiver habilitada para a galeria, o cliente pode comprar fotos além da quantidade incluída. As vendas aparecem na área Vendas."],
];

export default function AjudaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<Tipo>("problema");
  const [categoria, setCategoria] = useState<Categoria>("galerias");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [nota, setNota] = useState<number | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [origem, setOrigem] = useState("/ajuda");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState(false);

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
      setArquivo(null);
      if (arquivoRef.current) arquivoRef.current.value = "";
    } catch (error) {
      setErro(true);
      setAviso(error instanceof Error ? error.message : "Não foi possível enviar sua mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  return <>
    <MenuFotografo />
    <main className="help">
      <style>{`
        .help{min-height:100vh;margin-left:236px;background:linear-gradient(180deg,#F5F3FB,#EEEAF8);color:#21253A;padding:68px 42px 70px;box-sizing:border-box;font-family:Sora,sans-serif}
        .help-wrap{max-width:1120px;margin:0 auto}.ey{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7B7399}.help h1{font-size:30px;margin:7px 0 8px;letter-spacing:-.7px}.intro{max-width:650px;margin:0;color:#73758D;font-size:12px;line-height:1.65}
        .layout{display:grid;grid-template-columns:minmax(0,.9fr) minmax(360px,1.1fr);gap:18px;margin-top:25px}.panel{background:#FAF8FD;border:1px solid #DCD6EE;border-radius:17px;padding:20px;box-shadow:0 12px 34px rgba(50,35,86,.035)}
        .panel h2{font-size:16px;margin:0 0 5px}.small{font-size:10.5px;color:#7B7E93;line-height:1.55;margin:0}
        .faq-list{display:grid;gap:8px;margin-top:16px}.faq-item{border:1px solid #E0DAEA;border-radius:11px;background:#F6F3FA;overflow:hidden}.faq-item summary{cursor:pointer;list-style:none;padding:12px 13px;font-size:11px;font-weight:700;color:#454B65}.faq-item summary::-webkit-details-marker{display:none}.faq-item summary::after{content:"+";float:right;color:#8B7FB3}.faq-item[open] summary::after{content:"–"}.faq-item p{margin:0;padding:0 13px 13px;color:#73758D;font-size:10.5px;line-height:1.6}
        .support-note{margin-top:15px;padding:12px 13px;border-radius:11px;background:#F1EDF8;border:1px solid #DED5EC;color:#666B83;font-size:10.5px;line-height:1.55}.support-note strong{color:#353B55}
        .tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:15px;padding:4px;border-radius:11px;background:#EEEAF6}.tab{border:0;border-radius:8px;background:transparent;color:#73758D;padding:9px 8px;font:650 10px inherit;cursor:pointer}.tab.on{background:#FAF8FD;color:#3E4560;box-shadow:0 1px 4px rgba(32,24,58,.08)}
        .form{margin-top:16px;display:grid;gap:12px}.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{display:grid;gap:5px}.field span{font-size:9.5px;font-weight:700;color:#5D637B}.field input,.field select,.field textarea{width:100%;box-sizing:border-box;border:1px solid #D8D1E5;border-radius:10px;background:#F4F0F8;color:#252A40;padding:10px 11px;font:500 11px inherit;outline:0}.field textarea{min-height:128px;resize:vertical;line-height:1.55}.field input:focus,.field select:focus,.field textarea:focus{border-color:#8E7EC1;box-shadow:0 0 0 3px rgba(93,13,250,.07)}
        .file{padding:11px;border:1px dashed #CBC2DD;border-radius:11px;background:#F7F4FA}.file input{padding:0;border:0;background:transparent;font-size:10px}.hint{font-size:9px;color:#8B8EA0;line-height:1.45}
        .rating{display:flex;gap:6px}.rate{width:35px;height:34px;border:1px solid #D8D1E5;border-radius:9px;background:#F4F0F8;color:#666D84;font:700 11px inherit;cursor:pointer}.rate.on{border-color:#7C68BC;background:#EEE8FA;color:#493C73}
        .submit-line{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:2px}.submit{border:0;border-radius:10px;background:linear-gradient(135deg,#1196fc,#5d0dfa);color:#fff;padding:10px 15px;font:700 10.5px inherit;cursor:pointer}.submit:disabled{opacity:.55;cursor:not-allowed}.origin{font-size:9px;color:#9495A5;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .notice{margin-top:12px;padding:10px 12px;border-radius:10px;border:1px solid #CBE4D6;background:#EAF5EF;color:#3F7C5B;font-size:10.5px}.notice.err{border-color:#E7C7CC;background:#FAF0F2;color:#A6535E}
        @media(min-width:641px) and (max-width:980px){.help{margin-left:72px}}@media(max-width:850px){.help{padding:72px 24px 60px}.layout{grid-template-columns:1fr}.panel.form-panel{order:-1}}@media(max-width:640px){.help{margin-left:0;padding:76px 16px 50px}.help h1{font-size:25px}.row2{grid-template-columns:1fr}.tabs{grid-template-columns:1fr}.submit-line{align-items:stretch;flex-direction:column}.origin{max-width:100%}.submit{width:100%}}
      `}</style>
      <div className="help-wrap">
        <div className="ey">Suporte do Fotura</div>
        <h1>Ajuda e feedback</h1>
        <p className="intro">Encontre respostas rápidas ou conte o que aconteceu. Problemas, sugestões e opiniões chegam diretamente à administração do Fotura.</p>

        <div className="layout">
          <section className="panel">
            <h2>Central de ajuda</h2>
            <p className="small">Respostas rápidas para as dúvidas mais comuns do fluxo de trabalho.</p>
            <div className="faq-list">
              {faq.map(([pergunta, resposta]) => <details className="faq-item" key={pergunta}><summary>{pergunta}</summary><p>{resposta}</p></details>)}
            </div>
            <div className="support-note"><strong>Precisa falar com o suporte?</strong><br/>Use “Reportar problema” ao lado. Se precisarmos de mais detalhes, entraremos em contato pelo e-mail da sua conta.</div>
          </section>

          <section className="panel form-panel">
            <h2>Enviar uma mensagem</h2>
            <p className="small">Esta área é voluntária e não interrompe seu trabalho com avisos ou pop-ups.</p>

            <div className="tabs" role="tablist" aria-label="Tipo de mensagem">
              <button type="button" className={"tab"+(tipo==="problema"?" on":"")} onClick={()=>trocarTipo("problema")}>Reportar problema</button>
              <button type="button" className={"tab"+(tipo==="sugestao"?" on":"")} onClick={()=>trocarTipo("sugestao")}>Enviar sugestão</button>
              <button type="button" className={"tab"+(tipo==="feedback"?" on":"")} onClick={()=>trocarTipo("feedback")}>Dar feedback</button>
            </div>

            <form className="form" onSubmit={enviar}>
              <div className="row2">
                <label className="field"><span>Categoria</span><select value={categoria} onChange={e=>setCategoria(e.target.value as Categoria)}>{categorias.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label>
                <label className="field"><span>Assunto</span><input maxLength={120} value={assunto} onChange={e=>setAssunto(e.target.value)} placeholder={tipo==="problema"?"Ex.: erro ao abrir uma galeria":tipo==="sugestao"?"Ex.: nova opção de organização":"Ex.: minha experiência com o Fotura"}/></label>
              </div>

              {tipo==="feedback"&&<div className="field"><span>Avaliação opcional</span><div className="rating" aria-label="Avaliação de 1 a 5">{[1,2,3,4,5].map(n=><button type="button" key={n} className={"rate"+(nota===n?" on":"")} aria-pressed={nota===n} onClick={()=>setNota(nota===n?null:n)}>{n}</button>)}</div></div>}

              <label className="field"><span>{tipo==="problema"?"O que aconteceu?":tipo==="sugestao"?"Conte sua ideia":"O que você acha do Fotura até agora?"}</span><textarea maxLength={3000} value={mensagem} onChange={e=>setMensagem(e.target.value)} placeholder={tipo==="problema"?"Explique o que você estava fazendo, o que esperava e o que aconteceu.":tipo==="sugestao"?"Explique como a ideia ajudaria no seu trabalho.":"Conte o que está funcionando bem e o que poderíamos melhorar."}/><span className="hint">{mensagem.length}/3000</span></label>

              {tipo==="problema"&&<label className="field file"><span>Screenshot opcional</span><input ref={arquivoRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setArquivo(e.target.files?.[0]??null)}/><span className="hint">PNG, JPG ou WebP · até 5 MB. A imagem fica privada e só é acessível à administração.</span></label>}

              <div className="submit-line"><span className="origin" title={origem}>Origem registrada: {origem}</span><button className="submit" disabled={enviando} type="submit">{enviando?"Enviando…":"Enviar mensagem"}</button></div>
            </form>
            {aviso&&<div className={"notice"+(erro?" err":"")} role={erro?"alert":"status"}>{aviso}</div>}
          </section>
        </div>
      </div>
    </main>
  </>;
}
