
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MenuFotografo from "../../../MenuFotografo";
import { createClient } from "../../../../lib/supabase-client";

type Evento={id:number;evento:string;detalhes:Record<string,unknown>|null;criado_em:string;sessao_id:string|null};
type Lista={id:string;nome:string;fotos:string[];comentarios:Record<string,string>;finalizada:boolean;criado_em:string;atualizado_em:string};
type Projeto={id:string;nome:string;descricao:string|null;cliente_id:string|null;criado_em:string;atualizado_em:string};
type Preset={id:string;nome:string;config:Record<string,unknown>;criado_em:string;atualizado_em:string};
type Venda={id:string;qtd_extras:number;valor_total_centavos:number;moeda:string;status:string;criado_em:string;pago_em:string|null};
type Cliente={id:string;nome:string;email:string|null;telefone:string|null};
type Selecao={fotos:string[];finalizada:boolean;comentarios:Record<string,string>;atualizado_em:string|null};
type Galeria={
 id:string;user_id:string;slug:string;titulo:string;capa:string|null;prova:boolean;limite:number;prazo:string|null;link_ate:string|null;tem_senha:boolean;
 cliente_id:string|null;etapa:string;entrega_publicada_em:string|null;venda_extras_ativa:boolean;preco_foto_extra_centavos:number|null;projeto_id:string|null;
 download_ativo:boolean;download_individual:boolean;download_completo:boolean;download_tamanho:"original"|"web";download_pin_configurado:boolean;
 watermark_ativo:boolean;watermark_texto:string|null;watermark_opacidade:number;assistente_ativo:boolean;criado_em:string;publicRef:string;
};
type Dados={galeria:Galeria;cliente:Cliente|null;selecao:Selecao|null;listas:Lista[];projetos:Projeto[];presets:Preset[];vendas:Venda[];eventos:Evento[]};
type Aba="resumo"|"fotos"|"selecao"|"entrega"|"atividade"|"configuracoes"|"vendas";

const EVENTOS:Record<string,string>={
 public_gallery_view:"Cliente abriu a galeria",
 selection_started:"Cliente iniciou a seleção",
 gallery_comment_added:"Cliente deixou um comentário",
 selection_finalized:"Seleção finalizada",
 gallery_download_single:"Foto baixada",
 gallery_download_all:"Download da galeria",
 gallery_assist_opened:"Guia da galeria aberto",
 gallery_favorite_list_created:"Lista de favoritos criada",
 gallery_shared:"Galeria compartilhada",
 delivery_published:"Entrega publicada",
 extra_sale_payment_confirmed:"Pagamento de fotos extras confirmado",
};

function data(valor:string|null|undefined){
 if(!valor)return"—";
 return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(valor));
}
function dinheiro(centavos:number,moeda="brl"){
 return new Intl.NumberFormat("pt-BR",{style:"currency",currency:String(moeda||"brl").toUpperCase()}).format((centavos||0)/100);
}
function baixarArquivo(nome:string,conteudo:string,tipo="text/plain;charset=utf-8"){
 const blob=new Blob([conteudo],{type:tipo}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}

export default function GalleryWorkspacePage(){
 const id=useParams().id as string,router=useRouter(),supabase=useMemo(()=>createClient(),[]);
 const[dados,setDados]=useState<Dados|null>(null),[carregando,setCarregando]=useState(true),[erro,setErro]=useState(""),[aviso,setAviso]=useState(""),[aba,setAba]=useState<Aba>("resumo");
 const[fotoCount,setFotoCount]=useState<number|null>(null),[salvando,setSalvando]=useState(false);
 const[downloadAtivo,setDownloadAtivo]=useState(true),[downloadIndividual,setDownloadIndividual]=useState(true),[downloadCompleto,setDownloadCompleto]=useState(true),[downloadTamanho,setDownloadTamanho]=useState<"original"|"web">("original"),[downloadPin,setDownloadPin]=useState("");
 const[watermarkAtivo,setWatermarkAtivo]=useState(false),[watermarkTexto,setWatermarkTexto]=useState(""),[watermarkOpacidade,setWatermarkOpacidade]=useState(22),[assistenteAtivo,setAssistenteAtivo]=useState(true),[projetoId,setProjetoId]=useState("");
 const[novoProjeto,setNovoProjeto]=useState(""),[novoPreset,setNovoPreset]=useState("");
 const[origem,setOrigem]=useState("");

 async function token(){const{data}=await supabase.auth.getSession();return data.session?.access_token||""}
 async function carregar(){
  setCarregando(true);setErro("");
  const access=await token();if(!access){router.replace("/login");return}
  const r=await fetch(`/api/galeria/workspace?galeria=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){setErro(d.error||"Não foi possível abrir o workspace.");setCarregando(false);return}
  const w=d as Dados;setDados(w);aplicarForm(w.galeria);setOrigem(window.location.origin);
  try{let total=0,offset=0;while(true){const{data:arquivos,error}=await supabase.storage.from("fotos").list(`${w.galeria.user_id}/${id}`,{limit:1000,offset});if(error)break;const validos=(arquivos??[]).filter(a=>a.id!==null&&a.name!=="thumbs"&&a.name!=="entrega");total+=validos.length;if((arquivos??[]).length<1000)break;offset+=1000}setFotoCount(total)}catch{}
  setCarregando(false);
 }
 function aplicarForm(g:Galeria){setDownloadAtivo(g.download_ativo);setDownloadIndividual(g.download_individual);setDownloadCompleto(g.download_completo);setDownloadTamanho(g.download_tamanho);setWatermarkAtivo(g.watermark_ativo);setWatermarkTexto(g.watermark_texto||"");setWatermarkOpacidade(g.watermark_opacidade||22);setAssistenteAtivo(g.assistente_ativo);setProjetoId(g.projeto_id||"")}
 useEffect(()=>{void carregar()},[id]);

 async function salvarExperiencia(){
  if(!dados||salvando)return;setSalvando(true);setAviso("");
  const access=await token();try{
   const body:Record<string,unknown>={galeria:id,downloadAtivo,downloadIndividual,downloadCompleto,downloadTamanho,watermarkAtivo,watermarkTexto:watermarkTexto||null,watermarkOpacidade,assistenteAtivo,projetoId:projetoId||null};
   if(downloadPin.trim())body.downloadPin=downloadPin.trim();
   const r=await fetch("/api/galeria/workspace",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify(body)});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível salvar.");
   setDownloadPin("");setAviso("Experiência da galeria atualizada.");await carregar();
  }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível salvar.")}finally{setSalvando(false)}
 }
 async function removerPin(){
  if(!dados||salvando)return;setSalvando(true);const access=await token();
  const r=await fetch("/api/galeria/workspace",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({galeria:id,downloadPin:null})});
  setSalvando(false);if(r.ok){setAviso("PIN de download removido.");await carregar()}else setAviso("Não foi possível remover o PIN.");
 }
 async function acao(body:Record<string,unknown>){
  const access=await token();const r=await fetch("/api/galeria/workspace",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível concluir a ação.");return d;
 }
 async function criarProjeto(){if(!novoProjeto.trim())return;try{await acao({acao:"criar_projeto",nome:novoProjeto.trim(),clienteId:dados?.cliente?.id||null});setNovoProjeto("");setAviso("Projeto criado.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível criar o projeto.")}}
 async function salvarPreset(){if(!novoPreset.trim())return;try{await acao({acao:"salvar_preset",galeria:id,nome:novoPreset.trim()});setNovoPreset("");setAviso("Preset salvo.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível salvar o preset.")}}
 async function aplicarPreset(presetId:string){try{await acao({acao:"aplicar_preset",galeria:id,presetId});setAviso("Preset aplicado.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível aplicar o preset.")}}
 async function excluirPreset(presetId:string){try{await acao({acao:"excluir_preset",presetId});await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível excluir o preset.")}}
 async function excluirProjeto(pid:string){try{await acao({acao:"excluir_projeto",projetoId:pid});await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível excluir o projeto.")}}

 function exportar(lista:{nome:string;fotos:string[];comentarios?:Record<string,string>}){
  const base=lista.nome.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"selecao";
  const csv=["arquivo,comentario",...lista.fotos.map(n=>`"${n.replace(/"/g,'""')}","${(lista.comentarios?.[n]||"").replace(/"/g,'""')}"`)].join("\n");
  baixarArquivo(`${base}.csv`,csv,"text/csv;charset=utf-8");
 }
 async function copiarNomes(fotos:string[]){try{await navigator.clipboard.writeText(fotos.join("\n"));setAviso("Nomes dos arquivos copiados.")}catch{setAviso("Não foi possível copiar os nomes.")}}
 function lightroom(nome:string,fotos:string[]){baixarArquivo(`${nome.replace(/[^a-z0-9]+/gi,"-").toLowerCase()||"selecao"}-lightroom.txt`,fotos.join("\n"))}

 if(carregando)return <div className="gw-page"><MenuFotografo/><div className="gw-state">Carregando workspace…</div><style>{css}</style></div>;
 if(erro||!dados)return <div className="gw-page"><MenuFotografo/><div className="gw-state">{erro||"Galeria indisponível."}</div><style>{css}</style></div>;

 const g=dados.galeria,publicUrl=origem?`${origem}/g/${g.publicRef}`:"",principal={nome:"Seleção final",fotos:dados.selecao?.fotos??[],comentarios:dados.selecao?.comentarios??{}};
 const projetoAtual=dados.projetos.find(p=>p.id===g.projeto_id);
 const vendasPagas=dados.vendas.filter(v=>v.status==="pago"),receita=vendasPagas.reduce((s,v)=>s+v.valor_total_centavos,0),extras=vendasPagas.reduce((s,v)=>s+v.qtd_extras,0);
 const status=g.etapa==="entrega"?"Entregue":g.etapa==="preparando_entrega"?"Preparando entrega":dados.selecao?.finalizada?"Seleção finalizada":dados.selecao?"Seleção em andamento":g.prova?"Aguardando seleção":"Entrega direta";
 const mensagemShare=`Suas fotos estão prontas no Fotura: ${publicUrl}${g.tem_senha?"\nA galeria é protegida por senha.":""}${g.download_pin_configurado?"\nO download exige o PIN que enviei separadamente.":""}`;
 const compartilharWhats=publicUrl?`https://wa.me/?text=${encodeURIComponent(mensagemShare)}`:"#";
 const compartilharEmail=publicUrl?`mailto:?subject=${encodeURIComponent(g.titulo)}&body=${encodeURIComponent(mensagemShare)}`:"#";

 return <div className="gw-page"><MenuFotografo/><style>{css}</style><main className="gw-shell">
  <header className="gw-head"><div><button className="gw-back" onClick={()=>router.push("/dashboard/galerias")}>← Galerias</button><p>{projetoAtual?.nome||"Galeria"}</p><h1>{g.titulo}</h1><div className="gw-status"><span>{status}</span>{dados.cliente&&<span>{dados.cliente.nome}</span>}<span>{fotoCount??"—"} fotos</span></div></div><div className="gw-head-actions"><button onClick={()=>publicUrl&&window.open(publicUrl,"_blank")}>Ver como cliente</button><button className="primary" onClick={()=>router.push(`/upload?galeria=${id}`)}>+ Fotos</button></div></header>
  {aviso&&<div className="gw-notice">{aviso}</div>}
  <nav className="gw-tabs">{(["resumo","fotos","selecao","entrega","atividade","configuracoes","vendas"] as Aba[]).map(a=><button key={a} className={aba===a?"on":""} onClick={()=>setAba(a)}>{a==="resumo"?"Resumo":a==="fotos"?"Fotos":a==="selecao"?"Seleção":a==="entrega"?"Entrega":a==="atividade"?"Atividade":a==="configuracoes"?"Configurações":"Vendas"}</button>)}</nav>

  {aba==="resumo"&&<section className="gw-grid">
   <div className="gw-card gw-wide"><div className="gw-card-head"><div><span>Compartilhar</span><h2>Entrega com a sua marca</h2></div></div><div className="gw-share"><div className="gw-share-copy"><code>{publicUrl||"Carregando link…"}</code><button onClick={()=>void navigator.clipboard.writeText(publicUrl).then(()=>setAviso("Link copiado."))}>Copiar</button></div><div className="gw-share-actions"><a href={compartilharWhats} target="_blank" rel="noreferrer">WhatsApp</a><a href={compartilharEmail}>E-mail</a></div>{publicUrl&&<div className="gw-qr"><img src={`https://quickchart.io/qr?size=220&text=${encodeURIComponent(publicUrl)}`} alt="QR Code da galeria"/><div><strong>QR Code</strong><p>Útil para eventos, cartões de agradecimento e entregas presenciais.</p></div></div>}</div></div>
   <div className="gw-card"><span>Seleção</span><strong className="gw-number">{principal.fotos.length}</strong><p>{dados.selecao?.finalizada?"fotos confirmadas":"favoritas na seleção final"}</p><button onClick={()=>setAba("selecao")}>Abrir seleção</button></div>
   <div className="gw-card"><span>Atividade</span><strong className="gw-number">{dados.eventos.length}</strong><p>interações recentes registradas</p><button onClick={()=>setAba("atividade")}>Ver atividade</button></div>
   <div className="gw-card"><span>Vendas extras</span><strong className="gw-number">{extras}</strong><p>{dinheiro(receita,dados.vendas[0]?.moeda||"brl")} em volume pago</p><button onClick={()=>setAba("vendas")}>Ver vendas</button></div>
   <div className="gw-card"><span>Experiência</span><strong>{g.watermark_ativo?"Watermark ativo":"Watermark desligado"}</strong><p>{g.download_ativo?`Downloads: ${g.download_tamanho==="web"?"web":"original"}`:"Downloads desativados"} · {g.assistente_ativo?"guia ativo":"guia desligado"}</p><button onClick={()=>setAba("configuracoes")}>Configurar</button></div>
  </section>}

  {aba==="fotos"&&<section className="gw-section"><div className="gw-section-head"><div><span>Fotos</span><h2>{fotoCount??"—"} arquivos nesta galeria</h2><p>O upload continua resumível e pode ser retomado após interrupções.</p></div><button className="primary" onClick={()=>router.push(`/upload?galeria=${id}`)}>Adicionar fotos</button></div><div className="gw-empty-soft"><strong>Organização por projeto</strong><p>{projetoAtual?`Esta galeria pertence ao projeto “${projetoAtual.nome}”.`:"Associe a galeria a um projeto em Configurações para agrupar ensaios, cerimônia, festa ou diferentes etapas do mesmo trabalho."}</p></div></section>}

  {aba==="selecao"&&<section className="gw-section"><div className="gw-section-head"><div><span>Seleção e favoritos</span><h2>Do clique do cliente para o seu fluxo de edição</h2><p>Copie ou exporte os nomes dos arquivos sem precisar conferir foto por foto.</p></div></div>
   <ListaCard nome="Seleção final" fotos={principal.fotos} comentarios={principal.comentarios} finalizada={Boolean(dados.selecao?.finalizada)} onCopy={()=>copiarNomes(principal.fotos)} onCsv={()=>exportar(principal)} onLightroom={()=>lightroom("selecao-final",principal.fotos)}/>
   {dados.listas.map(l=><ListaCard key={l.id} nome={l.nome} fotos={l.fotos} comentarios={l.comentarios} finalizada={l.finalizada} auxiliar onCopy={()=>copiarNomes(l.fotos)} onCsv={()=>exportar(l)} onLightroom={()=>lightroom(l.nome,l.fotos)}/>)}
   {!dados.listas.length&&<div className="gw-empty-soft"><strong>Listas auxiliares</strong><p>O cliente pode criar listas adicionais dentro da galeria sem alterar a Seleção final que alimenta a entrega.</p></div>}
  </section>}

  {aba==="entrega"&&<section className="gw-section"><div className="gw-delivery"><div className={dados.selecao?.finalizada||!g.prova?"done":"active"}><b>1</b><div><strong>{g.prova?"Seleção do cliente":"Galeria direta"}</strong><p>{dados.selecao?.finalizada?`${principal.fotos.length} fotos confirmadas`:g.prova?"Aguardando o cliente finalizar":"Não exige prova"}</p></div></div><div className={g.etapa==="preparando_entrega"||g.etapa==="entrega"?"done":""}><b>2</b><div><strong>Preparar finais</strong><p>Baixe a seleção, edite e envie as versões finais.</p></div></div><div className={g.etapa==="entrega"?"done":""}><b>3</b><div><strong>Publicar entrega</strong><p>{g.entrega_publicada_em?`Publicada em ${data(g.entrega_publicada_em)}`:"A galeria final substitui a prova para o cliente."}</p></div></div></div><button className="primary gw-delivery-cta" onClick={()=>router.push(`/dashboard/entrega/${id}`)} disabled={g.prova&&!dados.selecao?.finalizada&&g.etapa!=="preparando_entrega"&&g.etapa!=="entrega"}>{g.etapa==="entrega"?"Revisar entrega":g.etapa==="preparando_entrega"?"Continuar entrega":"Preparar entrega"}</button></section>}

  {aba==="atividade"&&<section className="gw-section"><div className="gw-section-head"><div><span>Atividade do cliente</span><h2>O que aconteceu nesta galeria</h2><p>Visualizações, início e finalização da seleção, comentários, downloads e outras ações relevantes.</p></div></div><div className="gw-timeline">{dados.eventos.length?dados.eventos.map(e=><article key={e.id}><i/><div><strong>{EVENTOS[e.evento]||e.evento.replaceAll("_"," ")}</strong><p>{detalheEvento(e)}</p></div><time>{data(e.criado_em)}</time></article>):<div className="gw-empty-soft"><strong>Sem atividade ainda</strong><p>As novas interações do cliente passarão a aparecer aqui.</p></div>}</div></section>}

  {aba==="configuracoes"&&<section className="gw-section">
   <div className="gw-config-grid">
    <div className="gw-config-card"><span>Downloads</span><h3>Controle separado do acesso</h3><Toggle label="Permitir downloads" value={downloadAtivo} set={setDownloadAtivo}/><Toggle label="Foto individual" value={downloadIndividual} set={setDownloadIndividual} disabled={!downloadAtivo}/><Toggle label="Galeria completa" value={downloadCompleto} set={setDownloadCompleto} disabled={!downloadAtivo}/><label className="gw-field">Qualidade<select value={downloadTamanho} onChange={e=>setDownloadTamanho(e.target.value as "original"|"web")} disabled={!downloadAtivo}><option value="original">Original</option><option value="web">Web / compartilhamento</option></select></label><label className="gw-field">Novo PIN de download <small>{g.download_pin_configurado?"PIN configurado. Deixe vazio para manter.":"Opcional · 4 a 8 dígitos"}</small><input inputMode="numeric" value={downloadPin} onChange={e=>setDownloadPin(e.target.value.replace(/\D/g,"").slice(0,8))} placeholder={g.download_pin_configurado?"••••":"Ex: 4827"}/></label>{g.download_pin_configurado&&<button className="danger-lite" onClick={()=>void removerPin()}>Remover PIN</button>}</div>
    <div className="gw-config-card"><span>Watermark e guia</span><h3>Prova protegida e cliente orientado</h3><Toggle label="Watermark nas prévias" value={watermarkAtivo} set={setWatermarkAtivo}/><label className="gw-field">Texto do watermark<input value={watermarkTexto} onChange={e=>setWatermarkTexto(e.target.value.slice(0,80))} placeholder="Vazio usa a marca do estúdio"/></label><label className="gw-field">Opacidade · {watermarkOpacidade}%<input type="range" min="5" max="70" value={watermarkOpacidade} onChange={e=>setWatermarkOpacidade(Number(e.target.value))}/></label><Toggle label="Guia para o cliente na primeira visita" value={assistenteAtivo} set={setAssistenteAtivo}/><p className="gw-note">Quando o watermark está ativo em uma prova, o Fotura aplica a marca diretamente às prévias entregues ao cliente e mantém os originais fora da navegação.</p></div>
    <div className="gw-config-card"><span>Projeto / pasta</span><h3>Agrupe galerias do mesmo trabalho</h3><label className="gw-field">Projeto<select value={projetoId} onChange={e=>setProjetoId(e.target.value)}><option value="">Sem projeto</option>{dados.projetos.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><div className="gw-inline"><input value={novoProjeto} onChange={e=>setNovoProjeto(e.target.value)} placeholder="Novo projeto"/><button onClick={()=>void criarProjeto()}>Criar</button></div>{dados.projetos.map(p=><div className="gw-mini-row" key={p.id}><span>{p.nome}</span><button onClick={()=>void excluirProjeto(p.id)}>Excluir</button></div>)}</div>
    <div className="gw-config-card"><span>Presets</span><h3>Reutilize sua configuração</h3><div className="gw-inline"><input value={novoPreset} onChange={e=>setNovoPreset(e.target.value)} placeholder="Ex: Casamentos"/><button onClick={()=>void salvarPreset()}>Salvar atual</button></div>{dados.presets.length?dados.presets.map(p=><div className="gw-mini-row" key={p.id}><span>{p.nome}</span><div><button onClick={()=>void aplicarPreset(p.id)}>Aplicar</button><button onClick={()=>void excluirPreset(p.id)}>×</button></div></div>):<p className="gw-note">Salva modo de prova, limite, downloads, watermark e guia. Senhas e PINs nunca entram em presets.</p>}</div>
   </div>
   <button className="primary gw-save" onClick={()=>void salvarExperiencia()} disabled={salvando}>{salvando?"Salvando…":"Salvar experiência da galeria"}</button>
  </section>}

  {aba==="vendas"&&<section className="gw-section"><div className="gw-sales-summary"><div><span>Volume pago</span><strong>{dinheiro(receita,dados.vendas[0]?.moeda||"brl")}</strong></div><div><span>Fotos extras</span><strong>{extras}</strong></div><div><span>Vendas</span><strong>{vendasPagas.length}</strong></div></div><div className="gw-sales-list">{dados.vendas.length?dados.vendas.map(v=><article key={v.id}><div><strong>{v.qtd_extras} foto{v.qtd_extras===1?"":"s"} extra{v.qtd_extras===1?"":"s"}</strong><p>{data(v.criado_em)}</p></div><div><strong>{dinheiro(v.valor_total_centavos,v.moeda)}</strong><span className={`sale-${v.status}`}>{v.status}</span></div></article>):<div className="gw-empty-soft"><strong>Nenhuma venda nesta galeria</strong><p>Quando o cliente comprar fotos adicionais, elas aparecerão aqui.</p></div>}</div></section>}
 </main></div>
}

function ListaCard({nome,fotos,comentarios,finalizada,auxiliar,onCopy,onCsv,onLightroom}:{nome:string;fotos:string[];comentarios:Record<string,string>;finalizada:boolean;auxiliar?:boolean;onCopy:()=>void;onCsv:()=>void;onLightroom:()=>void}){
 return <article className="gw-list-card"><div><span>{auxiliar?"Lista auxiliar":"Seleção principal"}</span><h3>{nome}</h3><p>{fotos.length} foto{fotos.length===1?"":"s"} · {Object.keys(comentarios||{}).filter(k=>comentarios[k]?.trim()).length} comentário(s){finalizada?" · finalizada":""}</p></div><div className="gw-list-actions"><button onClick={onCopy}>Copiar nomes</button><button onClick={onCsv}>CSV</button><button onClick={onLightroom}>Lista Lightroom</button></div></article>
}
function Toggle({label,value,set,disabled}:{label:string;value:boolean;set:(v:boolean)=>void;disabled?:boolean}){return <label className={"gw-toggle"+(disabled?" disabled":"")}><input type="checkbox" checked={value} onChange={e=>set(e.target.checked)} disabled={disabled}/><span/><b>{label}</b></label>}
function detalheEvento(e:Evento){
 const d=e.detalhes||{};
 if(e.evento==="selection_finalized"||e.evento==="selection_started")return typeof d.fotos==="number"?`${d.fotos} foto(s)`:"Interação registrada";
 if(e.evento==="gallery_comment_added")return `${typeof d.arquivo==="string"?d.arquivo:"Foto"}${typeof d.lista==="string"?` · ${d.lista}`:""}`;
 if(e.evento.startsWith("gallery_download"))return `${typeof d.arquivo==="string"?d.arquivo:"Arquivos"}${typeof d.tamanho==="string"?` · ${d.tamanho}`:""}`;
 if(e.evento==="gallery_favorite_list_created")return typeof d.lista==="string"?`Lista “${d.lista}”`:"Lista criada";
 return "Interação registrada";
}

const css=`
.gw-page{min-height:100vh;background:#ece8f4;color:#22263b}.gw-shell{margin-left:230px;min-height:100vh;padding:34px clamp(24px,4vw,64px) 70px;box-sizing:border-box}.gw-state{margin-left:230px;min-height:100vh;display:grid;place-items:center;color:#74788f}.gw-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:22px}.gw-back{border:0;background:none;padding:0;color:#675b9d;font:700 12px inherit;cursor:pointer}.gw-head p{margin:13px 0 4px;color:#85889b;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.gw-head h1{margin:0;font-size:clamp(30px,4vw,48px);letter-spacing:-.045em;font-weight:650}.gw-status{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}.gw-status span{padding:6px 10px;border:1px solid #d4cce5;border-radius:999px;background:#f8f5fb;color:#666b82;font-size:10px;font-weight:750}.gw-head-actions{display:flex;gap:9px}.gw-head-actions button,.gw-section button,.gw-card button,.gw-share button,.gw-share a,.gw-inline button,.gw-list-actions button{border:1px solid #d0c7e2;border-radius:10px;background:#f9f7fc;color:#41465d;padding:10px 13px;font:700 12px inherit;text-decoration:none;cursor:pointer}.primary{border:0!important;background:linear-gradient(90deg,#1196fc,#5d0dfa)!important;color:#fff!important}.gw-notice{margin-bottom:18px;padding:11px 14px;border:1px solid #d7cee8;border-radius:11px;background:#f8f5fb;color:#5e637a;font-size:12px}.gw-tabs{display:flex;gap:5px;overflow:auto;padding:5px;margin-bottom:20px;border:1px solid #d8d1e7;border-radius:13px;background:#f5f1f9}.gw-tabs button{white-space:nowrap;border:0;border-radius:9px;padding:10px 13px;background:transparent;color:#74788e;font:700 11px inherit;cursor:pointer}.gw-tabs button.on{background:#fff;color:#30354c;box-shadow:0 3px 12px rgba(50,40,78,.08)}.gw-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.gw-card,.gw-section{border:1px solid #d7d0e7;border-radius:16px;background:#faf8fd;box-shadow:0 10px 32px rgba(47,39,74,.04)}.gw-card{padding:20px;min-height:160px}.gw-card.gw-wide{grid-column:span 2;min-height:270px}.gw-card>span,.gw-card-head span,.gw-section-head span,.gw-config-card>span{font-size:9px;text-transform:uppercase;letter-spacing:.13em;font-weight:850;color:#777096}.gw-card h2,.gw-section h2{margin:5px 0 14px;font-size:20px}.gw-card p{color:#7a7e91;font-size:12px;line-height:1.5;min-height:34px}.gw-card button{margin-top:8px}.gw-number{display:block;margin-top:15px;font-size:34px;letter-spacing:-.04em}.gw-share-copy{display:flex;gap:7px}.gw-share-copy code{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:11px;border:1px solid #ddd6e9;border-radius:9px;background:#f4f0f8;color:#60657a;font-size:11px}.gw-share-actions{display:flex;gap:7px;margin-top:9px}.gw-qr{display:flex;align-items:center;gap:13px;margin-top:15px;padding:12px;border:1px solid #e0d9eb;border-radius:12px;background:#fff}.gw-qr img{width:78px;height:78px}.gw-qr strong{font-size:12px}.gw-qr p{margin:4px 0 0;min-height:0;font-size:10px}.gw-section{padding:24px}.gw-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.gw-section-head h2{margin:5px 0 5px}.gw-section-head p{margin:0;color:#7b7f92;font-size:12px}.gw-empty-soft{padding:20px;border:1px dashed #d5cde4;border-radius:13px;background:#f6f2f9}.gw-empty-soft strong{font-size:13px}.gw-empty-soft p{margin:6px 0 0;color:#777b8f;font-size:12px;line-height:1.55}.gw-list-card{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid #e1dbea}.gw-list-card:last-of-type{border-bottom:0}.gw-list-card span{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#87899a}.gw-list-card h3{margin:4px 0;font-size:16px}.gw-list-card p{margin:0;color:#777c90;font-size:11px}.gw-list-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.gw-delivery{display:grid;gap:10px}.gw-delivery>div{display:flex;gap:13px;padding:15px;border:1px solid #ded8e8;border-radius:12px;background:#f5f2f8;opacity:.65}.gw-delivery>div.active,.gw-delivery>div.done{opacity:1;background:#fff}.gw-delivery b{width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:#e9e3f3;color:#686079}.gw-delivery .done b{background:#daf1e4;color:#337050}.gw-delivery strong{font-size:13px}.gw-delivery p{margin:3px 0 0;color:#787c90;font-size:11px}.gw-delivery-cta{margin-top:16px}.gw-timeline article{display:grid;grid-template-columns:16px 1fr auto;gap:10px;padding:14px 0;border-bottom:1px solid #e1dbea;align-items:center}.gw-timeline i{width:9px;height:9px;border-radius:50%;background:#6856b0;box-shadow:0 0 0 4px #ebe5f5}.gw-timeline strong{font-size:12px}.gw-timeline p{margin:3px 0 0;color:#7b7f91;font-size:10px}.gw-timeline time{color:#8a8d9e;font-size:10px}.gw-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.gw-config-card{padding:18px;border:1px solid #ddd6e8;border-radius:14px;background:#f7f4fa}.gw-config-card h3{margin:5px 0 15px;font-size:16px}.gw-field{display:grid;gap:6px;margin:12px 0;color:#62677d;font-size:11px;font-weight:700}.gw-field small{font-weight:500;color:#9092a2}.gw-field input:not([type=range]),.gw-field select,.gw-inline input{width:100%;box-sizing:border-box;min-height:40px;padding:0 10px;border:1px solid #d6cfe3;border-radius:9px;background:#fff;color:#33384d;outline:none}.gw-field input[type=range]{width:100%}.gw-toggle{display:flex;align-items:center;gap:9px;margin:11px 0;cursor:pointer}.gw-toggle input{display:none}.gw-toggle span{width:34px;height:19px;border-radius:999px;background:#cec8d9;position:relative;transition:.15s}.gw-toggle span:after{content:"";position:absolute;width:15px;height:15px;left:2px;top:2px;border-radius:50%;background:#fff;transition:.15s}.gw-toggle input:checked+span{background:#6756b0}.gw-toggle input:checked+span:after{transform:translateX(15px)}.gw-toggle b{font-size:11px}.gw-toggle.disabled{opacity:.45}.gw-inline{display:flex;gap:7px;margin:10px 0}.gw-mini-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #e0dae9;font-size:11px}.gw-mini-row button{padding:6px 8px}.gw-note{color:#808396;font-size:10.5px;line-height:1.55}.danger-lite{color:#a24e5c!important}.gw-save{margin-top:16px;min-width:220px}.gw-sales-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.gw-sales-summary div{padding:16px;border:1px solid #ddd6e8;border-radius:12px;background:#f6f2f9}.gw-sales-summary span{display:block;color:#85889a;font-size:10px}.gw-sales-summary strong{display:block;margin-top:5px;font-size:20px}.gw-sales-list article{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid #e2dcea}.gw-sales-list p{margin:4px 0 0;color:#858899;font-size:10px}.gw-sales-list article>div:last-child{display:grid;justify-items:end;gap:4px}.gw-sales-list article span{font-size:9px;text-transform:uppercase;letter-spacing:.08em}.sale-pago{color:#347252}.sale-pendente{color:#8b6d24}.sale-falhou,.sale-cancelado{color:#a2505b}
@media(max-width:1050px){.gw-shell,.gw-state{margin-left:0}.gw-shell{padding-top:86px}.gw-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gw-card.gw-wide{grid-column:span 2}}
@media(max-width:720px){.gw-shell{padding:80px 13px 50px}.gw-head{align-items:flex-start;flex-direction:column}.gw-head-actions{width:100%}.gw-head-actions button{flex:1}.gw-grid,.gw-config-grid,.gw-sales-summary{grid-template-columns:1fr}.gw-card.gw-wide{grid-column:auto}.gw-section{padding:16px}.gw-list-card,.gw-section-head{align-items:flex-start;flex-direction:column}.gw-list-actions{justify-content:flex-start}.gw-timeline article{grid-template-columns:14px 1fr}.gw-timeline time{grid-column:2}.gw-share-copy,.gw-inline{flex-direction:column}}
`;
