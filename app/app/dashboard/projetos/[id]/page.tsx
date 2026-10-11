"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MenuFotografo from "../../../MenuFotografo";
import { createClient } from "../../../../lib/supabase-client";

type Cliente={id:string;nome:string;email:string|null;telefone:string|null};
type Selecao={galeria:string;fotos:string[];finalizada:boolean;comentarios:Record<string,string>;atualizado_em:string|null};
type Pasta={id:string;slug:string;titulo:string;ordem:number;visivel:boolean;etapa:string;prova:boolean;criado_em:string;entrega_publicada_em:string|null;qtd:number;publicRef:string;selecao:Selecao|null};
type Venda={id:string;galeria:string;qtd_extras:number;valor_total_centavos:number;moeda:string;status:string;criado_em:string;pago_em:string|null};
type Evento={id:number;evento:string;entidade_id:string;detalhes:Record<string,unknown>|null;criado_em:string;sessao_id:string|null};
type Preset={id:string;nome:string;config:Record<string,unknown>;criado_em:string;atualizado_em:string};
type Projeto={
 id:string;user_id:string;cliente_id:string|null;nome:string;descricao:string|null;slug:string;capa_galeria_id:string|null;capa_arquivo:string|null;capaUrl:string|null;
 prova:boolean;limite:number;prazo:string|null;link_ate:string|null;tem_senha:boolean;venda_extras_ativa:boolean;preco_foto_extra_centavos:number|null;
 download_ativo:boolean;download_individual:boolean;download_completo:boolean;download_tamanho:"original"|"web";download_pin_configurado:boolean;
 watermark_ativo:boolean;watermark_texto:string|null;watermark_opacidade:number;assistente_ativo:boolean;criado_em:string;atualizado_em:string;publicRef:string;
};
type Dados={projeto:Projeto;cliente:Cliente|null;clientes:Cliente[];pastas:Pasta[];vendas:Venda[];eventos:Evento[];presets:Preset[]};
type Aba="resumo"|"pastas"|"selecao"|"entrega"|"atividade"|"configuracoes"|"vendas";
type CapaFoto={nome:string;url:string};

const EVENTOS:Record<string,string>={
 public_gallery_view:"Cliente abriu uma pasta",
 selection_started:"Cliente iniciou uma seleção",
 gallery_comment_added:"Cliente deixou um comentário",
 selection_finalized:"Seleção finalizada",
 gallery_download_single:"Foto baixada",
 gallery_download_all:"Download de uma pasta",
 gallery_assist_opened:"Guia aberto",
 gallery_shared:"Projeto compartilhado",
 delivery_published:"Entrega publicada",
 extra_sale_payment_confirmed:"Pagamento de fotos extras confirmado",
};

function dinheiro(centavos:number,moeda="brl"){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:String(moeda||"brl").toUpperCase()}).format((centavos||0)/100)}
function data(valor:string|null|undefined){if(!valor)return"—";return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(valor))}
function baixarArquivo(nome:string,conteudo:string,tipo="text/plain;charset=utf-8"){const blob=new Blob([conteudo],{type:tipo}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}

export default function ProjetoWorkspacePage(){
 const id=useParams().id as string,router=useRouter(),supabase=useMemo(()=>createClient(),[]);
 const[dados,setDados]=useState<Dados|null>(null),[carregando,setCarregando]=useState(true),[erro,setErro]=useState(""),[aviso,setAviso]=useState(""),[aba,setAba]=useState<Aba>("resumo"),[origem,setOrigem]=useState("");
 const[modalPasta,setModalPasta]=useState(false),[nomePasta,setNomePasta]=useState(""),[criandoPasta,setCriandoPasta]=useState(false);
 const[modalCapa,setModalCapa]=useState(false),[pastaCapa,setPastaCapa]=useState(""),[fotosCapa,setFotosCapa]=useState<CapaFoto[]>([]),[carregandoCapa,setCarregandoCapa]=useState(false),[salvandoCapa,setSalvandoCapa]=useState(false);
 const[salvando,setSalvando]=useState(false);
 const[nome,setNome]=useState(""),[descricao,setDescricao]=useState(""),[clienteId,setClienteId]=useState(""),[prova,setProva]=useState(true),[limite,setLimite]=useState("0"),[prazo,setPrazo]=useState(""),[linkAte,setLinkAte]=useState("");
 const[senha,setSenha]=useState(""),[vendaExtras,setVendaExtras]=useState(false),[precoExtra,setPrecoExtra]=useState("");
 const[downloadAtivo,setDownloadAtivo]=useState(true),[downloadIndividual,setDownloadIndividual]=useState(true),[downloadCompleto,setDownloadCompleto]=useState(true),[downloadTamanho,setDownloadTamanho]=useState<"original"|"web">("original"),[downloadPin,setDownloadPin]=useState("");
 const[watermarkAtivo,setWatermarkAtivo]=useState(false),[watermarkTexto,setWatermarkTexto]=useState(""),[watermarkOpacidade,setWatermarkOpacidade]=useState(22),[assistenteAtivo,setAssistenteAtivo]=useState(true);

 async function token(){const{data}=await supabase.auth.getSession();return data.session?.access_token||""}
 function aplicarForm(p:Projeto){
  setNome(p.nome);setDescricao(p.descricao||"");setClienteId(p.cliente_id||"");setProva(p.prova);setLimite(String(p.limite||0));setPrazo(p.prazo||"");setLinkAte(p.link_ate||"");
  setVendaExtras(p.venda_extras_ativa);setPrecoExtra(p.preco_foto_extra_centavos?String((p.preco_foto_extra_centavos/100).toFixed(2)).replace(".",","):"");
  setDownloadAtivo(p.download_ativo);setDownloadIndividual(p.download_individual);setDownloadCompleto(p.download_completo);setDownloadTamanho(p.download_tamanho);
  setWatermarkAtivo(p.watermark_ativo);setWatermarkTexto(p.watermark_texto||"");setWatermarkOpacidade(p.watermark_opacidade||22);setAssistenteAtivo(p.assistente_ativo);
 }
 async function carregar(){
  setCarregando(true);setErro("");
  const access=await token();if(!access){router.replace("/login");return}
  const r=await fetch(`/api/projeto/workspace?projeto=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){setErro(d.error||"Não foi possível abrir o projeto.");setCarregando(false);return}
  const w=d as Dados;setDados(w);aplicarForm(w.projeto);setOrigem(window.location.origin);setCarregando(false);
 }
 useEffect(()=>{void carregar()},[id]);

 async function post(body:Record<string,unknown>){
  const access=await token();if(!access)throw new Error("Sua sessão expirou.");
  const r=await fetch("/api/projeto/workspace",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível concluir a ação.");return d;
 }

 async function criarPasta(event:FormEvent){
  event.preventDefault();if(!nomePasta.trim()||criandoPasta)return;setCriandoPasta(true);setAviso("");
  try{
   const d=await post({acao:"criar_pasta",projetoId:id,nome:nomePasta.trim()}) as {pasta:{id:string}};
   setModalPasta(false);setNomePasta("");router.push(`/upload?galeria=${d.pasta.id}&projeto=${id}`);
  }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível criar a pasta.")}finally{setCriandoPasta(false)}
 }

 async function salvarConfiguracoes(){
  if(!dados||salvando)return;setSalvando(true);setAviso("");
  try{
   const access=await token();if(!access)throw new Error("Sua sessão expirou.");
   const preco=vendaExtras?Math.round(Number(precoExtra.replace(",","."))*100):null;
   const body:Record<string,unknown>={
    projeto:id,nome:nome.trim(),descricao:descricao.trim()||null,clienteId:clienteId||null,prova,limite:Math.max(0,parseInt(limite||"0",10)||0),prazo:prazo||null,linkAte:linkAte||null,
    vendaExtrasAtiva:vendaExtras,precoFotoExtraCentavos:preco,downloadAtivo,downloadIndividual,downloadCompleto,downloadTamanho,watermarkAtivo,watermarkTexto:watermarkTexto||null,watermarkOpacidade,assistenteAtivo
   };
   if(senha.trim())body.senha=senha.trim();
   if(downloadPin.trim())body.downloadPin=downloadPin.trim();
   const r=await fetch("/api/projeto/workspace",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify(body)});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível salvar.");
   setSenha("");setDownloadPin("");setAviso("Configurações do projeto atualizadas.");await carregar();
  }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível salvar.")}finally{setSalvando(false)}
 }

 async function removerSenha(){
  if(salvando)return;setSalvando(true);
  try{const access=await token();const r=await fetch("/api/projeto/workspace",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({projeto:id,removerSenha:true})});if(!r.ok)throw new Error();setAviso("Senha removida do projeto.");await carregar()}catch{setAviso("Não foi possível remover a senha.")}finally{setSalvando(false)}
 }
 async function removerPin(){
  if(salvando)return;setSalvando(true);
  try{const access=await token();const r=await fetch("/api/projeto/workspace",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({projeto:id,downloadPin:null})});if(!r.ok)throw new Error();setAviso("PIN de download removido.");await carregar()}catch{setAviso("Não foi possível remover o PIN.")}finally{setSalvando(false)}
 }

 async function abrirCapa(pastaId?:string){
  if(!dados?.pastas.length){setAviso("Adicione uma pasta com fotos antes de escolher a capa.");return}
  const pid=pastaId||dados.projeto.capa_galeria_id||dados.pastas[0].id;setPastaCapa(pid);setModalCapa(true);await carregarFotosCapa(pid);
 }
 async function carregarFotosCapa(pid:string){
  setPastaCapa(pid);setFotosCapa([]);setCarregandoCapa(true);
  try{const access=await token();const r=await fetch(`/api/projeto/workspace?projeto=${encodeURIComponent(id)}&capaPasta=${encodeURIComponent(pid)}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setFotosCapa((d.fotos??[]) as CapaFoto[])}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível carregar as fotos.")}finally{setCarregandoCapa(false)}
 }
 async function definirCapa(foto:CapaFoto){
  if(salvandoCapa)return;setSalvandoCapa(true);
  try{const access=await token();const r=await fetch("/api/projeto/workspace",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({projeto:id,capaPastaId:pastaCapa,capaArquivo:foto.nome})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível salvar a capa.");setModalCapa(false);setAviso("Capa do projeto atualizada para todas as pastas.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível salvar a capa.")}finally{setSalvandoCapa(false)}
 }

 function exportarSelecao(){
  if(!dados)return;
  const linhas=["pasta,arquivo,comentario"];
  for(const p of dados.pastas)for(const nome of p.selecao?.fotos??[])linhas.push(`"${p.titulo.replace(/"/g,'""')}","${nome.replace(/"/g,'""')}","${(p.selecao?.comentarios?.[nome]||"").replace(/"/g,'""')}"`);
  baixarArquivo(`${dados.projeto.slug||"projeto"}-selecao.csv`,linhas.join("\n"),"text/csv;charset=utf-8");
 }
 async function copiarSelecao(){
  if(!dados)return;const linhas=dados.pastas.flatMap(p=>(p.selecao?.fotos??[]).map(nome=>`${p.titulo}/${nome}`));
  try{await navigator.clipboard.writeText(linhas.join("\n"));setAviso("Seleção copiada.")}catch{setAviso("Não foi possível copiar a seleção.")}
 }

 if(carregando)return <div className="pw-page"><MenuFotografo/><style>{css}</style><div className="pw-state">Carregando projeto…</div></div>;
 if(erro||!dados)return <div className="pw-page"><MenuFotografo/><style>{css}</style><div className="pw-state">{erro||"Projeto indisponível."}</div></div>;

 const p=dados.projeto,publicUrl=origem?`${origem}/p/${p.publicRef}`:"";
 const totalFotos=dados.pastas.reduce((s,x)=>s+x.qtd,0),totalSelecionadas=dados.pastas.reduce((s,x)=>s+(x.selecao?.fotos.length??0),0),totalComentarios=dados.pastas.reduce((s,x)=>s+Object.values(x.selecao?.comentarios??{}).filter(v=>v?.trim()).length,0);
 const finalizadas=dados.pastas.filter(x=>x.selecao?.finalizada).length,entregues=dados.pastas.filter(x=>x.etapa==="entrega").length;
 const status=dados.pastas.length&&entregues===dados.pastas.length?"Entregue":dados.pastas.some(x=>x.etapa==="preparando_entrega")?"Preparando entrega":finalizadas?"Seleção em andamento":dados.pastas.length?"Ativo":"Sem pastas";
 const vendasPagas=dados.vendas.filter(v=>v.status==="pago"),receita=vendasPagas.reduce((s,v)=>s+v.valor_total_centavos,0),extras=vendasPagas.reduce((s,v)=>s+v.qtd_extras,0);
 const mensagemShare=`Suas fotos estão no Fotura: ${publicUrl}${p.tem_senha?"\nO projeto é protegido por senha.":""}${p.download_pin_configurado?"\nO download exige o PIN enviado separadamente.":""}`;
 const compartilharWhats=publicUrl?`https://wa.me/?text=${encodeURIComponent(mensagemShare)}`:"#",compartilharEmail=publicUrl?`mailto:?subject=${encodeURIComponent(p.nome)}&body=${encodeURIComponent(mensagemShare)}`:"#";

 return <div className="pw-page"><MenuFotografo/><style>{css}</style><main className="pw-shell">
  <header className="pw-head"><div><button className="pw-back" onClick={()=>router.push("/dashboard/projetos")}>← Projetos</button><p>PROJETO</p><h1>{p.nome}</h1><div className="pw-status"><span>{status}</span>{dados.cliente&&<span>{dados.cliente.nome}</span>}<span>{dados.pastas.length} pasta{dados.pastas.length===1?"":"s"}</span><span>{totalFotos} fotos</span></div></div><div className="pw-head-actions"><button onClick={()=>publicUrl&&window.open(publicUrl,"_blank","noopener,noreferrer")} disabled={!dados.pastas.length}>Ver como cliente</button><button className="primary" onClick={()=>setModalPasta(true)}>+ Nova pasta</button></div></header>
  {aviso&&<div className="pw-notice">{aviso}</div>}
  <nav className="pw-tabs">{(["resumo","pastas","selecao","entrega","atividade","configuracoes","vendas"] as Aba[]).map(a=><button key={a} className={aba===a?"on":""} onClick={()=>setAba(a)}>{a==="resumo"?"Resumo":a==="pastas"?"Pastas e fotos":a==="selecao"?"Seleção":a==="entrega"?"Entrega":a==="atividade"?"Atividade":a==="configuracoes"?"Configurações":"Vendas"}</button>)}</nav>

  {aba==="resumo"&&<section className="pw-grid">
   <div className="pw-card pw-cover-card"><span>Capa do projeto</span><div className="pw-cover">{p.capaUrl?<img src={p.capaUrl} alt="Capa do projeto"/>:<div>Sem capa</div>}<div className="pw-cover-overlay"><strong>{p.nome}</strong><small>Uma única capa para todas as pastas</small></div></div><button onClick={()=>void abrirCapa()} disabled={!dados.pastas.length}>Trocar capa</button></div>
   <div className="pw-card pw-wide"><span>Compartilhar</span><h2>Um único link para todo o trabalho</h2><div className="pw-share"><code>{publicUrl||"Carregando link…"}</code><button onClick={()=>void navigator.clipboard.writeText(publicUrl).then(()=>setAviso("Link do projeto copiado."))}>Copiar</button></div><div className="pw-share-actions"><a href={compartilharWhats} target="_blank" rel="noreferrer">WhatsApp</a><a href={compartilharEmail}>E-mail</a></div>{publicUrl&&<div className="pw-qr"><img src={`https://quickchart.io/qr?size=220&text=${encodeURIComponent(publicUrl)}`} alt="QR Code do projeto"/><p>O cliente abre o projeto e navega entre todas as pastas.</p></div>}</div>
   <div className="pw-card"><span>Seleção</span><strong className="pw-number">{totalSelecionadas}</strong><p>{finalizadas} pasta{finalizadas===1?"":"s"} com seleção finalizada · {totalComentarios} comentário(s)</p><button onClick={()=>setAba("selecao")}>Abrir seleção</button></div>
   <div className="pw-card"><span>Pastas</span><strong className="pw-number">{dados.pastas.length}</strong><p>{totalFotos} fotos organizadas neste projeto</p><button onClick={()=>setAba("pastas")}>Gerenciar pastas</button></div>
   <div className="pw-card"><span>Experiência</span><strong>{p.watermark_ativo?"Watermark ativo":"Watermark desligado"}</strong><p>{p.download_ativo?`Downloads: ${p.download_tamanho==="web"?"web":"original"}`:"Downloads desativados"} · {p.assistente_ativo?"guia ativo":"guia desligado"}</p><button onClick={()=>setAba("configuracoes")}>Configurar</button></div>
  </section>}

  {aba==="pastas"&&<section className="pw-section"><div className="pw-section-head"><div><span>PASTAS E FOTOS</span><h2>Organize o projeto sem criar links separados</h2><p>Cada pasta reúne um conjunto de fotos. A capa e as configurações pertencem ao projeto inteiro.</p></div><button className="primary" onClick={()=>setModalPasta(true)}>+ Nova pasta</button></div>{dados.pastas.length?<div className="pw-folder-list">{dados.pastas.map((x,i)=><article className="pw-folder" key={x.id}><div className="pw-folder-order">{String(i+1).padStart(2,"0")}</div><div className="pw-folder-copy"><strong>{x.titulo}</strong><p>{x.qtd} foto{x.qtd===1?"":"s"} · {x.selecao?.fotos.length??0} selecionada{x.selecao?.fotos.length===1?"":"s"}</p></div><span className={"pw-pill "+(x.etapa==="entrega"?"done":x.etapa==="preparando_entrega"?"prep":"active")}>{x.etapa==="entrega"?"Entregue":x.etapa==="preparando_entrega"?"Preparando":x.selecao?.finalizada?"Seleção finalizada":p.prova?"Prova":"Entrega"}</span><div className="pw-folder-actions"><button onClick={()=>router.push(`/upload?galeria=${x.id}&projeto=${id}`)}>+ Fotos</button><button onClick={()=>window.open(`${publicUrl}?pasta=${x.id}`,"_blank","noopener,noreferrer")}>Ver</button></div></article>)}</div>:<div className="pw-empty"><strong>Crie a primeira pasta</strong><p>Ex.: Making of, Cerimônia, Ensaio, Festa.</p><button className="primary" onClick={()=>setModalPasta(true)}>Criar pasta</button></div>}</section>}

  {aba==="selecao"&&<section className="pw-section"><div className="pw-section-head"><div><span>SELEÇÃO</span><h2>Todas as escolhas em um só lugar</h2><p>A seleção continua identificando a pasta de origem de cada foto.</p></div><div className="pw-head-buttons"><button onClick={()=>void copiarSelecao()} disabled={!totalSelecionadas}>Copiar nomes</button><button onClick={exportarSelecao} disabled={!totalSelecionadas}>Exportar CSV</button></div></div>{dados.pastas.map(x=><article className="pw-selection" key={x.id}><div><strong>{x.titulo}</strong><p>{x.selecao?.fotos.length??0} escolhida{x.selecao?.fotos.length===1?"":"s"} · {Object.values(x.selecao?.comentarios??{}).filter(v=>v?.trim()).length} comentário(s)</p></div><span className={"pw-pill "+(x.selecao?.finalizada?"done":"active")}>{x.selecao?.finalizada?"Finalizada":"Em andamento"}</span></article>)}{!dados.pastas.length&&<div className="pw-empty">Nenhuma pasta neste projeto.</div>}</section>}

  {aba==="entrega"&&<section className="pw-section"><div className="pw-section-head"><div><span>ENTREGA</span><h2>Acompanhe cada pasta até a publicação</h2><p>O cliente continua recebendo tudo dentro do mesmo projeto.</p></div></div><div className="pw-delivery-list">{dados.pastas.map(x=><article key={x.id}><div><strong>{x.titulo}</strong><p>{x.etapa==="entrega"?"Fotos finais publicadas":x.etapa==="preparando_entrega"?"Finais em preparação":x.selecao?.finalizada?"Seleção pronta para edição":p.prova?"Aguardando seleção do cliente":"Entrega direta"}</p></div><button className={x.etapa==="entrega"?"":"primary"} onClick={()=>router.push(`/dashboard/entrega/${x.id}`)} disabled={p.prova&&!x.selecao?.finalizada&&x.etapa!=="preparando_entrega"&&x.etapa!=="entrega"}>{x.etapa==="entrega"?"Revisar":x.etapa==="preparando_entrega"?"Continuar":"Preparar entrega"}</button></article>)}</div></section>}

  {aba==="atividade"&&<section className="pw-section"><div className="pw-section-head"><div><span>ATIVIDADE</span><h2>O que aconteceu no projeto</h2><p>Interações das diferentes pastas aparecem em uma única linha do tempo.</p></div></div><div className="pw-timeline">{dados.eventos.length?dados.eventos.map(e=>{const pasta=dados.pastas.find(x=>x.id===e.entidade_id||x.publicRef===e.entidade_id);return <article key={e.id}><i/><div><strong>{EVENTOS[e.evento]||e.evento.replaceAll("_"," ")}</strong><p>{pasta?.titulo||"Projeto"}{typeof e.detalhes?.arquivo==="string"?` · ${e.detalhes.arquivo}`:""}</p></div><time>{data(e.criado_em)}</time></article>}):<div className="pw-empty">As novas interações do cliente aparecerão aqui.</div>}</div></section>}

  {aba==="configuracoes"&&<section className="pw-section"><div className="pw-config-grid">
   <div className="pw-config-card"><span>PROJETO</span><h3>Identidade e organização</h3><label className="pw-field">Nome<input value={nome} onChange={e=>setNome(e.target.value)}/></label><label className="pw-field">Descrição<textarea value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Opcional"/></label><label className="pw-field">Cliente<select value={clienteId} onChange={e=>setClienteId(e.target.value)}><option value="">Sem cliente vinculado</option>{dados.clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><div className="pw-cover-config"><div>{p.capaUrl?<img src={p.capaUrl} alt=""/>:<span>Sem capa</span>}</div><button onClick={()=>void abrirCapa()} disabled={!dados.pastas.length}>Escolher capa do projeto</button></div><p className="pw-note">A capa é única e aparece em todas as pastas. Pastas não possuem capa individual.</p></div>
   <div className="pw-config-card"><span>PROVA</span><h3>Seleção do cliente</h3><Toggle label="Ativar prova e seleção" value={prova} set={setProva}/><label className="pw-field">Limite de fotos por pasta<input type="number" min="0" value={limite} onChange={e=>setLimite(e.target.value)}/><small>0 = sem limite. O limite é aplicado individualmente a cada pasta.</small></label><label className="pw-field">Prazo da seleção<input type="date" value={prazo} onChange={e=>setPrazo(e.target.value)}/></label><label className="pw-field">Validade do link<input type="date" value={linkAte} onChange={e=>setLinkAte(e.target.value)}/></label><label className="pw-field">Nova senha <small>{p.tem_senha?"Senha configurada. Deixe vazio para manter.":"Opcional"}</small><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder={p.tem_senha?"••••••":"Senha do projeto"}/></label>{p.tem_senha&&<button className="danger-lite" onClick={()=>void removerSenha()}>Remover senha</button>}</div>
   <div className="pw-config-card"><span>FOTOS EXTRAS</span><h3>Monetização da seleção</h3><Toggle label="Permitir compra de fotos adicionais" value={vendaExtras} set={setVendaExtras}/><label className="pw-field">Preço por foto extra<input value={precoExtra} onChange={e=>setPrecoExtra(e.target.value.replace(/[^0-9,.]/g,""))} placeholder="Ex: 8,00" disabled={!vendaExtras}/></label><p className="pw-note">A mesma regra é aplicada às pastas do projeto durante a transição para o fluxo unificado.</p></div>
   <div className="pw-config-card"><span>DOWNLOADS</span><h3>Permissões de entrega</h3><Toggle label="Permitir downloads" value={downloadAtivo} set={setDownloadAtivo}/><Toggle label="Foto individual" value={downloadIndividual} set={setDownloadIndividual} disabled={!downloadAtivo}/><Toggle label="Pasta completa" value={downloadCompleto} set={setDownloadCompleto} disabled={!downloadAtivo}/><label className="pw-field">Qualidade<select value={downloadTamanho} onChange={e=>setDownloadTamanho(e.target.value as "original"|"web")} disabled={!downloadAtivo}><option value="original">Original</option><option value="web">Web / compartilhamento</option></select></label><label className="pw-field">Novo PIN <small>{p.download_pin_configurado?"PIN configurado. Deixe vazio para manter.":"Opcional · 4 a 8 dígitos"}</small><input inputMode="numeric" value={downloadPin} onChange={e=>setDownloadPin(e.target.value.replace(/\D/g,"").slice(0,8))}/></label>{p.download_pin_configurado&&<button className="danger-lite" onClick={()=>void removerPin()}>Remover PIN</button>}</div>
   <div className="pw-config-card"><span>PROTEÇÃO</span><h3>Watermark e orientação</h3><Toggle label="Watermark nas prévias" value={watermarkAtivo} set={setWatermarkAtivo}/><label className="pw-field">Texto do watermark<input value={watermarkTexto} onChange={e=>setWatermarkTexto(e.target.value.slice(0,80))} placeholder="Vazio usa a marca do estúdio"/></label><label className="pw-field">Opacidade · {watermarkOpacidade}%<input type="range" min="5" max="70" value={watermarkOpacidade} onChange={e=>setWatermarkOpacidade(Number(e.target.value))}/></label><Toggle label="Guia na primeira visita" value={assistenteAtivo} set={setAssistenteAtivo}/></div>
  </div><button className="primary pw-save" onClick={()=>void salvarConfiguracoes()} disabled={salvando}>{salvando?"Salvando…":"Salvar configurações do projeto"}</button></section>}

  {aba==="vendas"&&<section className="pw-section"><div className="pw-sales-summary"><div><span>Volume pago</span><strong>{dinheiro(receita,dados.vendas[0]?.moeda||"brl")}</strong></div><div><span>Fotos extras</span><strong>{extras}</strong></div><div><span>Vendas</span><strong>{vendasPagas.length}</strong></div></div><div className="pw-sales-list">{dados.vendas.length?dados.vendas.map(v=>{const pasta=dados.pastas.find(x=>x.id===v.galeria);return <article key={v.id}><div><strong>{pasta?.titulo||"Pasta"}</strong><p>{v.qtd_extras} foto{v.qtd_extras===1?"":"s"} extra{v.qtd_extras===1?"":"s"} · {data(v.criado_em)}</p></div><div><strong>{dinheiro(v.valor_total_centavos,v.moeda)}</strong><span className={"sale-"+v.status}>{v.status}</span></div></article>}):<div className="pw-empty">Nenhuma venda registrada neste projeto.</div>}</div></section>}
 </main>

 {modalPasta&&<div className="pw-modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!criandoPasta)setModalPasta(false)}}><form className="pw-modal-card" onSubmit={criarPasta}><div className="pw-modal-head"><div><span>NOVA PASTA</span><h2>Adicionar fotos ao projeto</h2><p>A pasta aparecerá no mesmo link compartilhado com o cliente.</p></div><button type="button" onClick={()=>setModalPasta(false)} disabled={criandoPasta}>×</button></div><label className="pw-field">Nome da pasta<input autoFocus value={nomePasta} onChange={e=>setNomePasta(e.target.value)} placeholder="Ex: Cerimônia" required/></label><div className="pw-modal-actions"><button type="button" onClick={()=>setModalPasta(false)} disabled={criandoPasta}>Cancelar</button><button className="primary" type="submit" disabled={!nomePasta.trim()||criandoPasta}>{criandoPasta?"Criando…":"Criar e adicionar fotos"}</button></div></form></div>}

 {modalCapa&&<div className="pw-modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!salvandoCapa)setModalCapa(false)}}><div className="pw-modal-card pw-cover-modal"><div className="pw-modal-head"><div><span>CAPA DO PROJETO</span><h2>Escolha uma foto de qualquer pasta</h2><p>Esta será a única capa usada em todo o projeto.</p></div><button type="button" onClick={()=>setModalCapa(false)} disabled={salvandoCapa}>×</button></div><label className="pw-field">Pasta<select value={pastaCapa} onChange={e=>void carregarFotosCapa(e.target.value)}>{dados.pastas.map(x=><option key={x.id} value={x.id}>{x.titulo}</option>)}</select></label>{carregandoCapa?<div className="pw-empty">Carregando fotos…</div>:fotosCapa.length?<div className="pw-cover-grid">{fotosCapa.map(f=><button type="button" key={f.nome} onClick={()=>void definirCapa(f)} disabled={salvandoCapa}><img src={f.url} alt=""/><span>{f.nome}</span></button>)}</div>:<div className="pw-empty">Esta pasta ainda não tem fotos.</div>}</div></div>}
 </div>
}

function Toggle({label,value,set,disabled}:{label:string;value:boolean;set:(v:boolean)=>void;disabled?:boolean}){return <label className={"pw-toggle"+(disabled?" disabled":"")}><input type="checkbox" checked={value} onChange={e=>set(e.target.checked)} disabled={disabled}/><span/><b>{label}</b></label>}

const css=`
.pw-page{min-height:100vh;background:linear-gradient(180deg,#F0EDF7,#ECE8F4);color:#21253A}.pw-shell{max-width:1120px;margin:0 auto;padding:40px 40px 80px}.pw-state{min-height:100vh;display:grid;place-items:center;color:#74788f}.pw-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.pw-back{border:0;background:none;padding:0;color:#675b9d;font:700 11px inherit;cursor:pointer}.pw-head p{margin:10px 0 5px;color:#6f76a0;font-size:11px;letter-spacing:2px}.pw-head h1{margin:0;font-size:30px;letter-spacing:-.5px}.pw-status{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.pw-status span{padding:5px 8px;border:1px solid #d8d1e7;border-radius:999px;background:#f8f5fb;color:#666b82;font-size:9px;font-weight:750}.pw-head-actions{display:flex;gap:8px}.pw-head-actions button,.pw-card button,.pw-section button,.pw-share-actions a,.pw-head-buttons button{min-height:36px;border:1px solid #d0c7e2;border-radius:9px;background:#faf8fd;color:#4a5067;padding:0 11px;font:700 10.5px inherit;text-decoration:none;cursor:pointer}.pw-head-actions button:disabled,.pw-section button:disabled{opacity:.5;cursor:default}.primary{border:0!important;background:linear-gradient(90deg,#1196fc,#5d0dfa)!important;color:#fff!important}.pw-notice{margin-bottom:16px;padding:10px 12px;border:1px solid #d7cee8;border-radius:10px;background:#f8f5fb;color:#5e637a;font-size:11px}.pw-tabs{display:flex;gap:5px;overflow:auto;padding:5px;margin-bottom:18px;border:1px solid #d8d1e7;border-radius:12px;background:#f5f1f9}.pw-tabs button{white-space:nowrap;border:0;border-radius:8px;padding:9px 12px;background:transparent;color:#74788e;font:700 10.5px inherit;cursor:pointer}.pw-tabs button.on{background:#fff;color:#30354c;box-shadow:0 3px 12px rgba(50,40,78,.07)}
.pw-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.pw-card,.pw-section{border:1px solid #d7d0e7;border-radius:15px;background:#faf8fd;box-shadow:0 8px 26px rgba(47,39,74,.035)}.pw-card{padding:18px;min-height:145px}.pw-card.pw-wide{grid-column:span 2}.pw-cover-card{grid-row:span 2}.pw-card>span,.pw-section-head span,.pw-config-card>span,.pw-modal-head span{font-size:8.5px;text-transform:uppercase;letter-spacing:.13em;font-weight:850;color:#777096}.pw-card h2,.pw-section h2{margin:5px 0 12px;font-size:18px}.pw-card p{color:#7a7e91;font-size:11px;line-height:1.5;min-height:30px}.pw-number{display:block;margin:12px 0 3px;font-size:31px}.pw-cover{position:relative;height:188px;margin:10px 0;border:1px solid #ddd6e8;border-radius:11px;overflow:hidden;background:#eeeaf5;display:grid;place-items:center;color:#85899d}.pw-cover>img{width:100%;height:100%;object-fit:cover}.pw-cover-overlay{position:absolute;inset:auto 0 0;padding:28px 12px 11px;background:linear-gradient(transparent,rgba(13,13,26,.72));color:#fff}.pw-cover-overlay strong,.pw-cover-overlay small{display:block}.pw-cover-overlay small{margin-top:3px;font-size:8.5px;opacity:.78}.pw-share{display:flex;gap:7px}.pw-share code{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:10px;border:1px solid #ddd6e9;border-radius:8px;background:#f4f0f8;color:#60657a;font-size:10px}.pw-share-actions{display:flex;gap:7px;margin-top:8px}.pw-share-actions a{display:inline-flex;align-items:center}.pw-qr{display:flex;align-items:center;gap:11px;margin-top:11px;padding:10px;border:1px solid #e0d9eb;border-radius:10px;background:#fff}.pw-qr img{width:64px;height:64px}.pw-qr p{margin:0;min-height:0;font-size:9.5px}
.pw-section{padding:21px}.pw-section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:17px}.pw-section-head h2{margin:5px 0 4px}.pw-section-head p{margin:0;color:#7b7f92;font-size:11px}.pw-head-buttons{display:flex;gap:6px}.pw-folder-list{display:grid;gap:8px}.pw-folder{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;gap:11px;align-items:center;padding:10px 11px;border:1px solid #ddd7e7;border-radius:11px;background:#fcfafe}.pw-folder-order{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:#eee9f5;color:#6d6c82;font-size:9px;font-weight:800}.pw-folder-copy strong{font-size:12px}.pw-folder-copy p{margin:3px 0 0;color:#7c8093;font-size:9.5px}.pw-folder-actions{display:flex;gap:5px}.pw-pill{display:inline-flex;padding:4px 7px;border:1px solid;border-radius:999px;font-size:8px;font-weight:800;white-space:nowrap}.pw-pill.active{color:#97702D;background:#FBF2DB;border-color:#E8D4A0}.pw-pill.prep{color:#527A9A;background:#EAF4FB;border-color:#C9DFEE}.pw-pill.done{color:#3F7C5B;background:#E9F5EF;border-color:#C9E4D5}.pw-empty{padding:42px 16px;text-align:center;color:#7a7f92;font-size:11px}.pw-empty strong{display:block;color:#33384d;font-size:15px}.pw-empty p{margin:6px 0 12px}.pw-selection,.pw-delivery-list article,.pw-sales-list article{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid #e2dcea}.pw-selection:last-child,.pw-delivery-list article:last-child,.pw-sales-list article:last-child{border-bottom:0}.pw-selection strong,.pw-delivery-list strong,.pw-sales-list strong{font-size:12px}.pw-selection p,.pw-delivery-list p,.pw-sales-list p{margin:3px 0 0;color:#7c8093;font-size:9.5px}.pw-timeline article{display:grid;grid-template-columns:15px 1fr auto;gap:9px;align-items:center;padding:12px 0;border-bottom:1px solid #e1dbea}.pw-timeline i{width:8px;height:8px;border-radius:50%;background:#6856b0;box-shadow:0 0 0 4px #ebe5f5}.pw-timeline strong{font-size:11px}.pw-timeline p{margin:3px 0 0;color:#7b7f91;font-size:9.5px}.pw-timeline time{font-size:9px;color:#8a8d9e}
.pw-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pw-config-card{padding:16px;border:1px solid #ddd6e8;border-radius:13px;background:#f7f4fa}.pw-config-card h3{margin:5px 0 13px;font-size:15px}.pw-field{display:grid;gap:5px;margin:10px 0;color:#62677d;font-size:10px;font-weight:700}.pw-field small{font-weight:500;color:#9092a2}.pw-field input:not([type=range]),.pw-field select,.pw-field textarea{width:100%;box-sizing:border-box;min-height:38px;padding:0 9px;border:1px solid #d6cfe3;border-radius:8px;background:#fff;color:#33384d;outline:none}.pw-field textarea{min-height:68px;padding:9px;resize:vertical}.pw-field input[type=range]{width:100%}.pw-toggle{display:flex;align-items:center;gap:8px;margin:10px 0;cursor:pointer}.pw-toggle input{display:none}.pw-toggle span{width:32px;height:18px;border-radius:999px;background:#cec8d9;position:relative}.pw-toggle span:after{content:"";position:absolute;width:14px;height:14px;left:2px;top:2px;border-radius:50%;background:#fff;transition:.15s}.pw-toggle input:checked+span{background:#6756b0}.pw-toggle input:checked+span:after{transform:translateX(14px)}.pw-toggle b{font-size:10.5px}.pw-toggle.disabled{opacity:.45}.pw-note{color:#808396;font-size:9.5px;line-height:1.5}.danger-lite{color:#a24e5c!important}.pw-save{margin-top:15px;min-width:230px}.pw-cover-config{display:flex;align-items:center;gap:9px;margin-top:12px}.pw-cover-config>div{width:74px;height:52px;border:1px solid #ddd6e8;border-radius:8px;overflow:hidden;background:#eeeaf5;display:grid;place-items:center;color:#898c9e;font-size:8px}.pw-cover-config img{width:100%;height:100%;object-fit:cover}
.pw-sales-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}.pw-sales-summary div{padding:14px;border:1px solid #ddd6e8;border-radius:11px;background:#f6f2f9}.pw-sales-summary span{display:block;color:#85889a;font-size:9px}.pw-sales-summary strong{display:block;margin-top:4px;font-size:18px}.pw-sales-list article>div:last-child{display:grid;justify-items:end;gap:3px}.pw-sales-list article span{font-size:8px;text-transform:uppercase}.sale-pago{color:#347252}.sale-pendente{color:#8b6d24}.sale-falhou,.sale-cancelado{color:#a2505b}
.pw-modal{position:fixed;inset:0;z-index:130;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(20,18,31,.58);backdrop-filter:blur(8px)}.pw-modal-card{width:min(500px,100%);max-height:88vh;overflow:auto;box-sizing:border-box;padding:19px;border:1px solid #d8d1e7;border-radius:15px;background:#faf8fd;box-shadow:0 28px 80px rgba(31,25,53,.26)}.pw-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #e3deeb}.pw-modal-head h2{margin:5px 0 3px;font-size:18px}.pw-modal-head p{margin:0;color:#7a7f9a;font-size:10px}.pw-modal-head>button{width:32px;height:32px;border:1px solid #d7d0e7;border-radius:50%;background:#f3eff9;color:#656b82;font-size:19px}.pw-modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:16px}.pw-cover-modal{width:min(780px,100%)}.pw-cover-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pw-cover-grid button{position:relative;aspect-ratio:1;border:2px solid transparent;border-radius:9px;overflow:hidden;padding:0;background:#eeeaf5;cursor:pointer}.pw-cover-grid button:hover{border-color:#6756b0}.pw-cover-grid img{width:100%;height:100%;object-fit:cover}.pw-cover-grid span{position:absolute;left:0;right:0;bottom:0;padding:15px 5px 5px;background:linear-gradient(transparent,rgba(10,10,20,.7));color:#fff;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:1050px){.pw-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pw-cover-card{grid-row:auto}.pw-card.pw-wide{grid-column:span 2}.pw-folder{grid-template-columns:34px minmax(0,1fr) auto}.pw-folder-actions{grid-column:2/-1;justify-content:flex-end}}
@media(max-width:720px){.pw-shell{padding:76px 13px 50px}.pw-head{align-items:flex-start;flex-direction:column}.pw-head-actions{width:100%}.pw-head-actions button{flex:1}.pw-grid,.pw-config-grid,.pw-sales-summary{grid-template-columns:1fr}.pw-card.pw-wide{grid-column:auto}.pw-section{padding:15px}.pw-section-head{align-items:flex-start;flex-direction:column}.pw-folder{grid-template-columns:30px 1fr}.pw-folder-order{width:30px;height:30px}.pw-folder>.pw-pill{grid-column:2}.pw-folder-actions{grid-column:2;justify-content:flex-start}.pw-head-buttons{width:100%}.pw-head-buttons button{flex:1}.pw-timeline article{grid-template-columns:13px 1fr}.pw-timeline time{grid-column:2}.pw-share{flex-direction:column}.pw-cover-grid{grid-template-columns:repeat(3,1fr)}}
`;
