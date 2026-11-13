"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MenuFotografo from "../../../MenuFotografo";
import FolderSettingsDrawer from "../../../components/FolderSettingsDrawer";
import FoturaDrawer from "../../../components/FoturaDrawer";
import ModalSelecao from "../../../components/ModalSelecao";
import ProjectShareCenter from "../../ProjectShareCenter";
import ProjectPhotoManager from "../../ProjectPhotoManager";
import ProjectCinematicSettings from "../../ProjectCinematicSettings";
import { lerAbertura, type ConfigAbertura } from "../../../../lib/cinematic-intro";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, DragHandleIcon, ImageIcon, MoreIcon, PlusIcon, GridIcon, FolderIcon, CheckIcon, DownloadIcon, SettingsIcon, ActivityIcon, EyeIcon, LinkIcon, CopyIcon, ShareIcon, ShoppingBagIcon, SparklesIcon, PencilIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "../../../components/FoturaIcons";
import "../../project-workspace-refined.css";
import { createClient } from "../../../../lib/supabase-client";
import { type ModeloProjeto } from "../../../../lib/project-templates";
import { registrarEventoProduto } from "../../../../lib/product-analytics";

type Cliente={id:string;nome:string;email:string|null;telefone:string|null};
type Selecao={galeria:string;fotos:string[];finalizada:boolean;comentarios:Record<string,string>;atualizado_em:string|null};
type Pasta={id:string;slug:string;titulo:string;capa:string|null;capaUrl:string|null;ordem:number;visivel:boolean;etapa:string;prova:boolean;criado_em:string;entrega_publicada_em:string|null;qtd:number;publicRef:string;selecao:Selecao|null};
type Venda={id:string;galeria:string;qtd_extras:number;valor_total_centavos:number;moeda:string;status:string;criado_em:string;pago_em:string|null};
type Evento={id:number;evento:string;entidade_id:string;detalhes:Record<string,unknown>|null;criado_em:string;sessao_id:string|null};
type Preset={id:string;nome:string;config:Record<string,unknown>;criado_em:string;atualizado_em:string};
type Projeto={
 id:string;user_id:string;cliente_id:string|null;nome:string;descricao:string|null;slug:string;modelo:ModeloProjeto|null;capa_galeria_id:string|null;capa_arquivo:string|null;capaUrl:string|null;
 prova:boolean;limite:number;prazo:string|null;link_ate:string|null;tem_senha:boolean;venda_extras_ativa:boolean;preco_foto_extra_centavos:number|null;
 download_ativo:boolean;download_individual:boolean;download_completo:boolean;download_tamanho:"original"|"web";download_pin_configurado:boolean;
 watermark_ativo:boolean;watermark_texto:string|null;watermark_opacidade:number;assistente_ativo:boolean;abertura_config?:unknown;og_capa_autorizada:boolean;criado_em:string;atualizado_em:string;publicRef:string;
};
type Comercial={planoCodigo:string;assinaturaAtiva:boolean;stripeRecebimentosAtivo:boolean;vendaFotosDisponivel:boolean};
type Dados={projeto:Projeto;cliente:Cliente|null;clientes:Cliente[];pastas:Pasta[];vendas:Venda[];eventos:Evento[];presets:Preset[];comercial:Comercial};
type Aba="resumo"|"selecao"|"entrega"|"atividade"|"configuracoes"|"vendas";
type ConfigSecao="projeto"|"abertura"|"selecao"|"entrega"|"vendas"|"avancado";
type CapaFoto={nome:string;url:string};

const EVENTOS:Record<string,string>={
 public_gallery_view:"Cliente abriu uma galeria",
 selection_started:"Cliente iniciou uma seleção",
 gallery_comment_added:"Cliente deixou um comentário",
 selection_finalized:"Seleção finalizada",
 gallery_download_single:"Foto baixada",
 gallery_download_all:"Download de uma galeria",
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
 const[compartilharAberto,setCompartilharAberto]=useState(false),[gerenciadorPasta,setGerenciadorPasta]=useState<string|null>(null); 
 const[menuProjetoAberto,setMenuProjetoAberto]=useState(false),[menuPastaAberta,setMenuPastaAberta]=useState<string|null>(null);
 const[configSecao,setConfigSecao]=useState<ConfigSecao>("projeto");
 const[configuracoesAbertas,setConfiguracoesAbertas]=useState(false);
 const[modalPasta,setModalPasta]=useState(false),[nomePasta,setNomePasta]=useState(""),[criandoPasta,setCriandoPasta]=useState(false),[selecaoModal,setSelecaoModal]=useState<string|null>(null);
 const[pastaDetalhes,setPastaDetalhes]=useState<string|null>(null);
 const[editandoPasta,setEditandoPasta]=useState<string|null>(null),[nomePastaEdicao,setNomePastaEdicao]=useState(""),[salvandoPasta,setSalvandoPasta]=useState<string|null>(null),[excluirPasta,setExcluirPasta]=useState<Pasta|null>(null),[excluindoPasta,setExcluindoPasta]=useState(false),[reordenandoPastas,setReordenandoPastas]=useState(false),[arrastandoPasta,setArrastandoPasta]=useState<string|null>(null);
 const[capaIndividual,setCapaIndividual]=useState(false);
 const[modalCapa,setModalCapa]=useState(false),[pastaCapa,setPastaCapa]=useState(""),[fotosCapa,setFotosCapa]=useState<CapaFoto[]>([]),[carregandoCapa,setCarregandoCapa]=useState(false),[salvandoCapa,setSalvandoCapa]=useState(false);
 const[modalExcluirProjeto,setModalExcluirProjeto]=useState(false),[confirmacaoProjeto,setConfirmacaoProjeto]=useState(""),[excluindoProjeto,setExcluindoProjeto]=useState(false);
 const[salvando,setSalvando]=useState(false);
 const[nome,setNome]=useState(""),[descricao,setDescricao]=useState(""),[clienteId,setClienteId]=useState(""),[prova,setProva]=useState(true),[limite,setLimite]=useState("0"),[prazo,setPrazo]=useState(""),[linkAte,setLinkAte]=useState("");
 const[senha,setSenha]=useState(""),[vendaExtras,setVendaExtras]=useState(false),[precoExtra,setPrecoExtra]=useState("");
 const[downloadAtivo,setDownloadAtivo]=useState(true),[downloadIndividual,setDownloadIndividual]=useState(true),[downloadCompleto,setDownloadCompleto]=useState(true),[downloadPin,setDownloadPin]=useState("");
 const[assistenteAtivo,setAssistenteAtivo]=useState(true);
 const[abertura,setAbertura]=useState<ConfigAbertura>(()=>lerAbertura(null));
 const[ogCapaAutorizada,setOgCapaAutorizada]=useState(false);

 async function token(){const{data}=await supabase.auth.getSession();return data.session?.access_token||""}
 function aplicarForm(p:Projeto){
  setNome(p.nome);setDescricao(p.descricao||"");setClienteId(p.cliente_id||"");setProva(p.prova);setLimite(String(p.limite||0));setPrazo(p.prazo||"");setLinkAte(p.link_ate||"");
  setVendaExtras(p.venda_extras_ativa);setPrecoExtra(p.preco_foto_extra_centavos?String((p.preco_foto_extra_centavos/100).toFixed(2)).replace(".",","):"");
  setDownloadAtivo(p.download_ativo);setDownloadIndividual(p.download_individual);setDownloadCompleto(p.download_completo);
  setAssistenteAtivo(p.assistente_ativo);setAbertura(lerAbertura(p.abertura_config));setOgCapaAutorizada(Boolean(p.og_capa_autorizada));
 }
 async function carregar(){
  setCarregando(true);setErro("");
  const access=await token();if(!access){router.replace("/login");return}
  const r=await fetch(`/api/projeto/workspace?projeto=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){setErro(d.error||"Não foi possível abrir o projeto.");setCarregando(false);return}
  const recebido=d as Dados;const w={...recebido,comercial:recebido.comercial??{planoCodigo:"sem_plano",assinaturaAtiva:false,stripeRecebimentosAtivo:false,vendaFotosDisponivel:false}};setDados(w);aplicarForm(w.projeto);setOrigem(window.location.origin);setCarregando(false);
 }
 useEffect(()=>{void carregar()},[id]);
 useEffect(()=>{const valor=new URLSearchParams(window.location.search).get("aba");if(valor==="configuracoes")setConfiguracoesAbertas(true);else if(valor==="pastas")setAba("resumo");else if(valor&&["resumo","selecao","entrega","atividade","vendas"].includes(valor))setAba(valor as Aba)},[id]);
 useEffect(()=>{if(dados&&!dados.projeto.prova&&(aba==="selecao"||aba==="entrega"))setAba("resumo")},[dados,aba]);
 useEffect(()=>{
  function fecharMenus(event:PointerEvent){
   const alvo=event.target;
   if(alvo instanceof Element&&alvo.closest(".pw-overflow-wrap"))return;
   setMenuProjetoAberto(false);setMenuPastaAberta(null);
  }
  function teclado(event:KeyboardEvent){if(event.key==="Escape"){setMenuProjetoAberto(false);setMenuPastaAberta(null)}}
  document.addEventListener("pointerdown",fecharMenus);window.addEventListener("keydown",teclado);
  return()=>{document.removeEventListener("pointerdown",fecharMenus);window.removeEventListener("keydown",teclado)}
 },[]);

 async function post(body:Record<string,unknown>){
  const access=await token();if(!access)throw new Error("Sua sessão expirou.");
  const r=await fetch("/api/projeto/workspace",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível concluir a ação.");return d;
 }

 async function criarPasta(event:FormEvent){
  event.preventDefault();if(!nomePasta.trim()||criandoPasta)return;setCriandoPasta(true);setAviso("");
  try{
   const d=await post({acao:"criar_pasta",projetoId:id,nome:nomePasta.trim()}) as {pasta:{id:string}};
   registrarEventoProduto("gallery_created",{token:await token(),entidade:"galeria",entidadeId:d.pasta.id,detalhes:{modo:"nova"}});
   setModalPasta(false);setNomePasta("");router.push(`/upload?galeria=${d.pasta.id}&projeto=${id}`);
  }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível criar a pasta.")}finally{setCriandoPasta(false)}
 }

 function abrirDetalhesPasta(pasta:Pasta){setMenuPastaAberta(null);setPastaDetalhes(pasta.id)}
 function iniciarRenomearPasta(pasta:Pasta){
  setEditandoPasta(pasta.id);setNomePastaEdicao(pasta.titulo);setAviso("");
 }
 async function salvarNomePasta(pasta:Pasta){
  const novoNome=nomePastaEdicao.trim();if(!novoNome||salvandoPasta)return;
  if(novoNome===pasta.titulo){setEditandoPasta(null);return}
  setSalvandoPasta(pasta.id);setAviso("");
  try{
   await post({acao:"atualizar_pasta",projetoId:id,pastaId:pasta.id,nome:novoNome});
   setDados(atual=>atual?{...atual,pastas:atual.pastas.map(x=>x.id===pasta.id?{...x,titulo:novoNome}:x)}:atual);
   setEditandoPasta(null);setNomePastaEdicao("");setAviso("Nome da pasta atualizado.");
  }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível renomear a pasta.")}
  finally{setSalvandoPasta(null)}
 }
 function rotuloAcaoPasta(pasta:Pasta){
  if(pasta.etapa==="entrega")return"Revisar entrega";
  if(pasta.etapa==="preparando_entrega")return"Continuar entrega";
  if(pasta.selecao?.finalizada||(!dados?.projeto.prova&&pasta.qtd>0))return"Preparar entrega";
  return"Adicionar fotos";
 }
 function abrirAcaoPasta(pasta:Pasta){
  if(pasta.etapa==="entrega"||pasta.etapa==="preparando_entrega"||pasta.selecao?.finalizada||(!dados?.projeto.prova&&pasta.qtd>0))router.push(`/dashboard/entrega/${pasta.id}`);
  else router.push(`/upload?galeria=${pasta.id}&projeto=${id}`);
 }
 async function alternarVisibilidadePasta(pasta:Pasta){
  if(salvandoPasta||reordenandoPastas)return;setSalvandoPasta(pasta.id);setAviso("");
  const proximo=!pasta.visivel;
  try{
   await post({acao:"atualizar_pasta",projetoId:id,pastaId:pasta.id,visivel:proximo});
   setDados(atual=>atual?{...atual,pastas:atual.pastas.map(x=>x.id===pasta.id?{...x,visivel:proximo}:x)}:atual);
   setAviso(proximo?"Pasta publicada no projeto do cliente.":"Pasta ocultada do projeto do cliente.");
  }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível alterar a visibilidade.")}
  finally{setSalvandoPasta(null)}
 }
 async function salvarOrdemPastas(novas:Pasta[]){
  if(!dados||reordenandoPastas)return;
  const anterior=dados.pastas;
  const ordenadas=novas.map((x,i)=>({...x,ordem:i}));
  setDados({...dados,pastas:ordenadas});setReordenandoPastas(true);setAviso("");
  try{
   await post({acao:"reordenar_pastas",projetoId:id,pastas:ordenadas.map(x=>x.id)});
   setAviso("Ordem das pastas atualizada.");
  }catch(e){
   setDados(atual=>atual?{...atual,pastas:anterior}:atual);
   setAviso(e instanceof Error?e.message:"Não foi possível reordenar as pastas.");
  }finally{setReordenandoPastas(false);setArrastandoPasta(null)}
 }
 function moverPasta(indice:number,direcao:-1|1){
  if(!dados||reordenandoPastas)return;const destino=indice+direcao;if(destino<0||destino>=dados.pastas.length)return;
  const novas=[...dados.pastas];const[item]=novas.splice(indice,1);novas.splice(destino,0,item);void salvarOrdemPastas(novas);
 }
 function soltarPasta(destinoId:string){
  if(!dados||!arrastandoPasta||arrastandoPasta===destinoId||reordenandoPastas){setArrastandoPasta(null);return}
  const origem=dados.pastas.findIndex(x=>x.id===arrastandoPasta),destino=dados.pastas.findIndex(x=>x.id===destinoId);
  if(origem<0||destino<0){setArrastandoPasta(null);return}
  const novas=[...dados.pastas];const[item]=novas.splice(origem,1);novas.splice(destino,0,item);void salvarOrdemPastas(novas);
 }
 async function confirmarExclusaoPasta(){
  if(!excluirPasta||excluindoPasta)return;setExcluindoPasta(true);setAviso("");
  try{
   const access=await token();if(!access)throw new Error("Sua sessão expirou.");
   const r=await fetch("/api/galeria/excluir",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({galeria:excluirPasta.id})});
   const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível excluir a pasta.");
   setExcluirPasta(null);setEditandoPasta(null);
   setAviso(d.aviso||"Pasta e suas fotos foram excluídas.");
   await carregar();
  }catch(e){setAviso(e instanceof Error?e.message:"Não foi possível excluir a pasta.")}
  finally{setExcluindoPasta(false)}
 }

 async function confirmarExclusaoProjeto(){
  if(!dados||excluindoProjeto||confirmacaoProjeto.trim()!==dados.projeto.nome)return;
  setExcluindoProjeto(true);setAviso("");
  try{
   const d=await post({acao:"excluir_projeto",projetoId:id,confirmacao:confirmacaoProjeto.trim()}) as {ok?:boolean;limpezaPendente?:boolean;aviso?:string};
   setModalExcluirProjeto(false);setConfirmacaoProjeto("");
   router.replace("/dashboard/projetos");
   router.refresh();
   if(d.limpezaPendente&&d.aviso)console.warn(d.aviso);
  }catch(e){
   setAviso(e instanceof Error?e.message:"Não foi possível excluir o projeto.");
   setModalExcluirProjeto(false);setConfirmacaoProjeto("");
  }finally{setExcluindoProjeto(false)}
 }

 function abrirConfiguracoes(){setConfigSecao("projeto");setMenuProjetoAberto(false);setConfiguracoesAbertas(true)}
 function fecharConfiguracoes(){if(!salvando&&!modalCapa&&!modalExcluirProjeto)setConfiguracoesAbertas(false)}

 async function salvarConfiguracoes(){
  if(!dados||salvando)return;setSalvando(true);setAviso("");
  try{
   const access=await token();if(!access)throw new Error("Sua sessão expirou.");
   const preco=vendaExtras?Math.round(Number(precoExtra.replace(",","."))*100):null;
   const body:Record<string,unknown>={
    projeto:id,nome:nome.trim(),descricao:descricao.trim()||null,clienteId:clienteId||null,prova,limite:Math.max(0,parseInt(limite||"0",10)||0),prazo:prazo||null,linkAte:linkAte||null,
    vendaExtrasAtiva:dados.comercial.vendaFotosDisponivel&&vendaExtras,precoFotoExtraCentavos:dados.comercial.vendaFotosDisponivel?preco:null,downloadAtivo,downloadIndividual,downloadCompleto,assistenteAtivo,abertura,ogCapaAutorizada
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

 async function abrirCapa(pastaId?:string,individual=false){
  setCapaIndividual(individual);
  if(!dados?.pastas.length){setAviso("Adicione uma pasta com fotos antes de escolher a capa.");return}
  const pid=pastaId||dados.projeto.capa_galeria_id||dados.pastas[0].id;setPastaCapa(pid);setModalCapa(true);await carregarFotosCapa(pid);
 }
 async function carregarFotosCapa(pid:string){
  setPastaCapa(pid);setFotosCapa([]);setCarregandoCapa(true);
  try{const access=await token();const r=await fetch(`/api/projeto/workspace?projeto=${encodeURIComponent(id)}&capaPasta=${encodeURIComponent(pid)}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setFotosCapa((d.fotos??[]) as CapaFoto[])}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível carregar as fotos.")}finally{setCarregandoCapa(false)}
 }
 async function definirCapa(foto:CapaFoto){
  if(salvandoCapa)return;setSalvandoCapa(true);
  try{const access=await token();const r=await fetch("/api/projeto/workspace",{method:capaIndividual?"POST":"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify(capaIndividual?{acao:"atualizar_pasta",projetoId:id,pastaId:pastaCapa,capaArquivo:foto.nome}:{projeto:id,capaPastaId:pastaCapa,capaArquivo:foto.nome})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Não foi possível salvar a capa.");setModalCapa(false);setAviso(capaIndividual?"Capa da pasta atualizada.":"Capa do projeto atualizada.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível salvar a capa.")}finally{setSalvandoCapa(false)}
 }

 async function removerCapaPasta(){
  if(salvandoCapa)return;setSalvandoCapa(true);
  try{const access=await token();const r=await fetch("/api/projeto/workspace",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({acao:"atualizar_pasta",projetoId:id,pastaId:pastaCapa,capaArquivo:null})});const d=await r.json();if(!r.ok)throw new Error(d.error);setModalCapa(false);setAviso("A pasta voltou a usar a capa do projeto.");await carregar()}catch(e){setAviso(e instanceof Error?e.message:"Não foi possível remover a capa.")}finally{setSalvandoCapa(false)}
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

 async function copiarLinkProjeto(){
  if(!publicUrl)return;
  try{await navigator.clipboard.writeText(publicUrl);setAviso("Link do projeto copiado.");setMenuProjetoAberto(false)}
  catch{setAviso("Não foi possível copiar o link.")}
 }

 if(carregando)return <div className="pw-page mf-shift"><MenuFotografo/><style>{css}</style><div className="pw-state">Carregando projeto…</div></div>;
 if(erro||!dados)return <div className="pw-page mf-shift"><MenuFotografo/><style>{css}</style><div className="pw-state"><div className="pw-state-card"><strong>Não foi possível abrir o projeto</strong><span>{erro||"Projeto indisponível."}</span><div><button type="button" onClick={()=>void carregar()}>Tentar novamente</button><button type="button" className="secondary" onClick={()=>router.push("/dashboard/projetos")}>Voltar para Projetos</button></div></div></div></div>;

 const pastaNoPainel=dados.pastas.find(x=>x.id===pastaDetalhes)||null;
 const p=dados.projeto,publicUrl=origem?`${origem}/p/${p.publicRef}`:"";
 const galeriaUnica=p.modelo==="ensaio"||p.modelo==="entrega";
 const galeriaPrincipal=galeriaUnica?dados.pastas[0]??null:null;
 const totalFotos=dados.pastas.reduce((s,x)=>s+x.qtd,0),totalSelecionadas=dados.pastas.reduce((s,x)=>s+(x.selecao?.fotos.length??0),0),totalComentarios=dados.pastas.reduce((s,x)=>s+Object.values(x.selecao?.comentarios??{}).filter(v=>v?.trim()).length,0);
 const finalizadas=dados.pastas.filter(x=>x.selecao?.finalizada).length,entregues=dados.pastas.filter(x=>x.etapa==="entrega").length;
 const status=dados.pastas.length&&entregues===dados.pastas.length?"Entregue":dados.pastas.some(x=>x.etapa==="preparando_entrega")?"Preparando entrega":p.prova&&finalizadas?"Seleção em andamento":galeriaUnica&&totalFotos===0?"Aguardando fotos":dados.pastas.length?"Ativo":"Sem galerias";
 const vendasPagas=dados.vendas.filter(v=>v.status==="pago"),receita=vendasPagas.reduce((s,v)=>s+v.valor_total_centavos,0),extras=vendasPagas.reduce((s,v)=>s+v.qtd_extras,0);
 const proximoPasso = !dados.pastas.length
   ? {titulo:"Crie sua primeira galeria",descricao:"Comece organizando as fotografias deste projeto.",botao:"Criar galeria",destino:"criar"}
   : totalFotos===0
     ? {titulo:"Adicione as primeiras fotos",descricao:"As galerias estão prontas. Envie as fotografias para começar.",botao:galeriaUnica?"Adicionar fotos":"Abrir galerias",destino:galeriaUnica?"upload":"pastas"}
     : p.prova&&finalizadas>0&&entregues<dados.pastas.length
       ? {titulo:"Prepare as fotos escolhidas",descricao:"A seleção foi finalizada. Organize os arquivos para a entrega.",botao:"Ver entregas",destino:"entrega"}
       : !p.prova&&entregues<dados.pastas.length
         ? {titulo:"Prepare a entrega",descricao:"As fotos já foram adicionadas. Acesse a galeria para preparar a entrega.",botao:"Ver galerias",destino:"pastas"}
         : entregues===dados.pastas.length
           ? {titulo:"Seu projeto está entregue",descricao:"Confira a experiência e compartilhe o link com o cliente.",botao:"Compartilhar",destino:"compartilhar"}
           : {titulo:"Envie o link para o cliente",descricao:"As fotografias estão disponíveis. Confira e compartilhe o projeto com o cliente.",botao:"Compartilhar",destino:"compartilhar"};
 function irParaGalerias(){document.getElementById("pw-gallery-section")?.scrollIntoView({behavior:"smooth",block:"start"})}
 function abrirProximoPasso(){
   if(proximoPasso.destino==="criar")galeriaUnica?irParaGalerias():setModalPasta(true);
   else if(proximoPasso.destino==="upload"&&galeriaPrincipal)router.push("/upload?galeria="+galeriaPrincipal.id+"&projeto="+id);
   else if(proximoPasso.destino==="compartilhar")setCompartilharAberto(true);
   else if(proximoPasso.destino==="pastas")irParaGalerias();
   else setAba(proximoPasso.destino as Aba);
 }

 return <div className="pw-page mf-shift"><MenuFotografo/><style>{css}</style><main className="pw-shell">
  <header className="pw-head">
    <div className="pw-head-copy">
      <button className="pw-back" onClick={()=>router.push("/dashboard/projetos")}><ArrowLeftIcon size={15}/> Voltar aos projetos</button>
      <p>ESPAÇO DE TRABALHO</p>
      <h1 title={p.nome}>{p.nome}</h1>
      <div className="pw-status"><span className="pw-status-primary">{status}</span>{dados.cliente&&<span><span aria-hidden="true">· </span>{dados.cliente.nome}</span>}<span>{galeriaUnica?"Galeria única":"Projeto com galerias"} · {p.prova?"Seleção pelo cliente":"Entrega direta"}</span></div>
    </div>
    <div className="pw-head-actions">
      {galeriaUnica
        ? <button className="primary pw-main-action" onClick={()=>galeriaPrincipal&&router.push("/upload?galeria="+galeriaPrincipal.id+"&projeto="+id)} disabled={!galeriaPrincipal}><PlusIcon size={16}/> Adicionar fotos</button>
        : <button className="primary pw-main-action" onClick={()=>setModalPasta(true)}><PlusIcon size={16}/> Nova galeria</button>}
      <button className="pw-share-action" onClick={()=>setCompartilharAberto(true)}><ShareIcon size={16}/> Compartilhar</button>
      <div className="pw-overflow-wrap">
        <button className={"pw-more pw-more-labeled"+(menuProjetoAberto?" open":"")} aria-label="Outras ações do projeto" aria-haspopup="menu" aria-expanded={menuProjetoAberto} onClick={()=>{setMenuProjetoAberto(v=>!v);setMenuPastaAberta(null)}}><MoreIcon size={18}/><span>Mais</span></button>
        {menuProjetoAberto&&<div className="pw-overflow-menu project" role="menu">
          <div className="pw-menu-label">APRESENTAÇÃO</div>
          <button role="menuitem" onClick={()=>{setMenuProjetoAberto(false);if(publicUrl)window.open(publicUrl,"_blank","noopener,noreferrer")}} disabled={!dados.pastas.length}><EyeIcon size={16}/> Ver como cliente</button>
          <button role="menuitem" className={configuracoesAbertas?"active":""} onClick={abrirConfiguracoes}><SettingsIcon size={16}/> Configurações do projeto</button>
          <div className="pw-menu-sep"/>
          <div className="pw-menu-label">ACOMPANHAMENTO</div>
          <button role="menuitem" className={aba==="atividade"?"active":""} onClick={()=>{setAba("atividade");setMenuProjetoAberto(false)}}><ActivityIcon size={16}/> Atividade do cliente</button>
          <button role="menuitem" className={aba==="vendas"?"active":""} onClick={()=>{setAba("vendas");setMenuProjetoAberto(false)}}><ShoppingBagIcon size={16}/> Vendas de fotos extras</button>
        </div>}
      </div>
    </div>
  </header>
  {aviso&&<div className="pw-notice">{aviso}</div>}
  <nav className="pw-tabs" aria-label="Navegação do projeto">
     {(["resumo",...(p.prova?["selecao","entrega"]:[])] as Aba[]).map(a=>
       <button key={a} className={aba===a?"on":""} aria-current={aba===a?"page":undefined} onClick={()=>{setAba(a);setMenuProjetoAberto(false)}}>
         {a==="resumo"?<FolderIcon size={17}/>:a==="selecao"?<CheckIcon size={17}/>:<DownloadIcon size={17}/>}
         <span>{a==="resumo"?(galeriaUnica?"Minha galeria":"Galerias e fotos"):a==="selecao"?"Seleção":"Entrega"}</span>
       </button>)}
     {(["atividade","vendas"] as Aba[]).includes(aba)&&<span className="pw-secondary-current" aria-current="page">
       {aba==="atividade"?<ActivityIcon size={17}/>:aba==="vendas"?<ShoppingBagIcon size={17}/>:<SettingsIcon size={17}/>}
       <span>{aba==="atividade"?"Atividade":aba==="vendas"?"Vendas":"Configurações"}</span>
     </span>}
   </nav>

  {aba==="resumo"&&<>
    <section className="pw-overview-grid" aria-label="Resumo do projeto">
      <article className="pw-overview-card pw-project-summary">
        <div className="pw-summary-cover">{p.capaUrl?<img src={p.capaUrl} alt="Capa do projeto"/>:<span><ImageIcon size={25}/></span>}</div>
        <div className="pw-summary-copy">
          <span>PRÓXIMO PASSO</span>
          <h2>{proximoPasso.titulo}</h2>
          <p>{proximoPasso.descricao}</p>
          <button className="pw-link-button" onClick={abrirProximoPasso}>{proximoPasso.botao}<ArrowRightIcon size={15}/></button>
        </div>
      </article>
      <article className="pw-overview-card pw-client-link-card">
        <div className="pw-card-head">
          <div><span>ACESSO DO CLIENTE</span><h2>Link do projeto</h2></div>
          <span className="pw-client-link-symbol" aria-hidden="true"><LinkIcon size={21}/></span>
        </div>
        <p>{galeriaUnica?"O cliente acessa as fotos diretamente, sem escolher pastas.":"Todas as galerias publicadas ficam acessíveis pelo mesmo link."}</p>
        <div className="pw-share"><code title={publicUrl}>{publicUrl||"Carregando link…"}</code><button onClick={()=>void copiarLinkProjeto()} disabled={!publicUrl} title="Copiar link do projeto"><CopyIcon size={16}/><span>Copiar</span></button></div>
        <button className="pw-link-button pw-preview-link" onClick={()=>{if(publicUrl)window.open(publicUrl,"_blank","noopener,noreferrer")}} disabled={!publicUrl}><EyeIcon size={15}/> Ver como cliente <ArrowRightIcon size={14}/></button>
      </article>
    </section>
    <section className="pw-metrics" aria-label="Resumo em números">
      <button onClick={irParaGalerias}><FolderIcon size={18}/><strong>{galeriaUnica?1:dados.pastas.length}</strong><span>{galeriaUnica?"Galeria principal":"Galerias"}</span></button>
      <button onClick={irParaGalerias}><ImageIcon size={18}/><strong>{totalFotos}</strong><span>Fotos no projeto</span></button>
      <button onClick={()=>setAba(p.prova?"selecao":"entrega")}>{p.prova?<CheckIcon size={18}/>:<DownloadIcon size={18}/>}<strong>{p.prova?totalSelecionadas:entregues}</strong><span>{p.prova?"Fotos selecionadas":"Galerias entregues"}</span></button>
    </section>
  </>}

  {aba==="resumo"&&galeriaUnica&&<section id="pw-gallery-section" className="pw-section pw-single-section"><div className="pw-section-head"><div><span>{p.prova?"SELEÇÃO DE FOTOS":"ENTREGA DIRETA"}</span><h2>Sua galeria, pronta para receber fotos</h2><p>{p.prova?"Adicione as fotos para seu cliente escolher as favoritas e deixar comentários.":"Adicione as fotos prontas. Seu cliente abrirá esta galeria diretamente, sem passar por pastas."}</p></div></div>{galeriaPrincipal?<div className="pw-single-gallery"><div className="pw-single-cover">{galeriaPrincipal.capaUrl?<img src={galeriaPrincipal.capaUrl} alt="Capa da galeria"/>:<ImageIcon size={34}/>}</div><div className="pw-single-copy"><span>GALERIA ÚNICA</span><h3>{p.nome}</h3><p>{galeriaPrincipal.qtd} foto{galeriaPrincipal.qtd===1?"":"s"} {p.prova?"· Seleção disponível":"· Entrega sem seleção"}</p><div className="pw-single-actions"><button type="button" className="primary" onClick={()=>router.push(`/upload?galeria=${galeriaPrincipal.id}&projeto=${id}`)}><PlusIcon size={15}/> Enviar fotos</button><button type="button" onClick={()=>setGerenciadorPasta(galeriaPrincipal.id)} disabled={!galeriaPrincipal.qtd}><ImageIcon size={15}/> Organizar fotos</button>{!p.prova&&galeriaPrincipal.qtd>0&&<button type="button" onClick={()=>router.push(`/dashboard/entrega/${galeriaPrincipal.id}`)}><DownloadIcon size={15}/> {rotuloAcaoPasta(galeriaPrincipal)}</button>}</div></div></div>:<div className="pw-empty">Não foi possível localizar a galeria principal. Atualize a página ou entre em contato com o suporte.</div>}</section>}

  {aba==="resumo"&&!galeriaUnica&&<section id="pw-gallery-section" className="pw-section"><div className="pw-section-head"><div><span>GALERIAS DO PROJETO</span><h2>Organize suas galerias</h2><p>Gerencie fotos, visibilidade e ordem de exibição para o cliente.</p></div><div className="pw-folder-summary"><small><EyeIcon size={14}/>{dados.pastas.filter(x=>x.visivel).length} publicada{dados.pastas.filter(x=>x.visivel).length===1?"":"s"}</small><small className="pw-sort-tip"><DragHandleIcon size={14}/> Arraste para ordenar</small></div></div>{dados.pastas.length?<div className="pw-folder-list">{dados.pastas.map((x,i)=><article className={"pw-folder"+(!x.visivel?" hidden":"")+(arrastandoPasta===x.id?" dragging":"")} key={x.id} draggable={!reordenandoPastas&&editandoPasta!==x.id} onDragStart={e=>{setArrastandoPasta(x.id);e.dataTransfer.effectAllowed="move"}} onDragOver={e=>{if(arrastandoPasta&&arrastandoPasta!==x.id)e.preventDefault()}} onDrop={e=>{e.preventDefault();soltarPasta(x.id)}} onDragEnd={()=>setArrastandoPasta(null)}><div className="pw-folder-cover" title="Arraste para reordenar">{x.capaUrl?<img src={x.capaUrl} alt="" loading="lazy" draggable={false}/>:<span className="pw-folder-cover-empty" aria-hidden="true"><ImageIcon size={18}/></span>}<span className="pw-folder-cover-shade"/><span className="pw-drag" aria-hidden="true"><DragHandleIcon size={16}/></span><b>{String(i+1).padStart(2,"0")}</b></div><div className="pw-folder-copy">{editandoPasta===x.id?<div className="pw-folder-edit"><input autoFocus value={nomePastaEdicao} onChange={e=>setNomePastaEdicao(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void salvarNomePasta(x)}if(e.key==="Escape"){setEditandoPasta(null);setNomePastaEdicao("")}}} maxLength={120}/><button className="save" onClick={()=>void salvarNomePasta(x)} disabled={!nomePastaEdicao.trim()||salvandoPasta===x.id}>{salvandoPasta===x.id?"Salvando…":"Salvar"}</button><button onClick={()=>{setEditandoPasta(null);setNomePastaEdicao("")}} disabled={salvandoPasta===x.id}>Cancelar</button></div>:<div className="pw-folder-title"><button type="button" className="pw-folder-open" onClick={()=>abrirDetalhesPasta(x)} aria-label={"Detalhes e configurações de "+x.titulo}>{x.titulo}</button><span className={"pw-visibility "+(x.visivel?"published":"hidden")}>{x.visivel?"Publicada":"Oculta"}</span></div>}<p>{x.qtd} foto{x.qtd===1?"":"s"}{p.prova&&<> · {x.selecao?.fotos.length??0} escolhida{(x.selecao?.fotos.length??0)===1?"":"s"}</>}</p></div><span className={"pw-pill "+(x.etapa==="entrega"?"done":x.etapa==="preparando_entrega"?"prep":"active")}>{x.etapa==="entrega"?"Entregue":x.etapa==="preparando_entrega"?"Preparando":x.selecao?.finalizada?"Seleção finalizada":p.prova?"Seleção aberta":"Entrega direta"}</span><div className="pw-folder-actions"><button className="pw-folder-primary" onClick={()=>abrirAcaoPasta(x)}>{x.etapa==="entrega"?<EyeIcon size={15}/>:x.etapa==="preparando_entrega"||x.selecao?.finalizada?<DownloadIcon size={15}/>:<PlusIcon size={15}/>} {rotuloAcaoPasta(x)}</button><div className="pw-overflow-wrap"><button className={"pw-more folder"+(menuPastaAberta===x.id?" open":"")} aria-label={`Mais ações de ${x.titulo}`} aria-haspopup="menu" aria-expanded={menuPastaAberta===x.id} onClick={()=>{setMenuPastaAberta(v=>v===x.id?null:x.id);setMenuProjetoAberto(false)}}><MoreIcon size={18}/></button>{menuPastaAberta===x.id&&<div className={"pw-overflow-menu folder"+(i>=2&&i>=dados.pastas.length-2?" opens-up":"")} role="menu">
  <div className="pw-menu-label">VISUALIZAR E EDITAR</div>
  <button role="menuitem" onClick={()=>{setMenuPastaAberta(null);window.open(publicUrl+"?pasta="+x.id,"_blank","noopener,noreferrer")}} disabled={!x.visivel}><EyeIcon size={15}/> Ver como cliente</button>
  <button role="menuitem" onClick={()=>{setMenuPastaAberta(null);setGerenciadorPasta(x.id)}} disabled={!x.qtd}><ImageIcon size={15}/> Organizar fotos</button>
  <button role="menuitem" onClick={()=>{setMenuPastaAberta(null);void abrirCapa(x.id,true)}} disabled={!x.qtd}><ImageIcon size={15}/> Escolher capa</button>
  <button role="menuitem" onClick={()=>{setMenuPastaAberta(null);iniciarRenomearPasta(x)}} disabled={salvandoPasta===x.id}><PencilIcon size={15}/> Renomear galeria</button>
  <button role="menuitem" onClick={()=>{setMenuPastaAberta(null);void alternarVisibilidadePasta(x)}} disabled={salvandoPasta===x.id}><EyeIcon size={15}/> {x.visivel?"Ocultar do cliente":"Publicar para o cliente"}</button>
  <div className="pw-menu-sep"/>
  <div className="pw-menu-label">ORDEM NO PROJETO</div>
  <button role="menuitem" onClick={()=>{setMenuPastaAberta(null);moverPasta(i,-1)}} disabled={i===0||reordenandoPastas}><ArrowUpIcon size={15}/> Mover para cima</button>
  <button role="menuitem" onClick={()=>{setMenuPastaAberta(null);moverPasta(i,1)}} disabled={i===dados.pastas.length-1||reordenandoPastas}><ArrowDownIcon size={15}/> Mover para baixo</button>
  <div className="pw-menu-sep"/>
  <button role="menuitem" className="danger" onClick={()=>{setMenuPastaAberta(null);setExcluirPasta(x)}} disabled={salvandoPasta===x.id}><TrashIcon size={15}/> Excluir galeria</button>
 </div>}</div></div></article>)}</div>:<div className="pw-empty pw-empty-guided"><FolderIcon size={27}/><strong>Comece pela primeira galeria</strong><p>Você pode separar as fotos por tema, local ou momento.</p><button className="primary" onClick={()=>setModalPasta(true)}><PlusIcon size={15}/> Criar galeria</button></div>}</section>}

  {aba==="selecao"&&<section className="pw-section"><div className="pw-section-head"><div><span>SELEÇÃO</span><h2>Todas as escolhas em um só lugar</h2><p>Veja as fotos escolhidas e os comentários de cada galeria. O cliente pode selecionar diretamente no link compartilhado.</p></div><div className="pw-head-buttons"><button onClick={()=>void copiarSelecao()} disabled={!totalSelecionadas}>Copiar nomes</button><button onClick={exportarSelecao} disabled={!totalSelecionadas}>Exportar CSV</button></div></div>{dados.pastas.map(x=><article className="pw-selection" key={x.id}><div><strong>{x.titulo}</strong><p>{x.selecao?.fotos.length??0} escolhida{x.selecao?.fotos.length===1?"":"s"} · {Object.values(x.selecao?.comentarios??{}).filter(v=>v?.trim()).length} comentário(s)</p></div><div className="pw-selection-actions"><span className={"pw-pill "+(x.selecao?.finalizada?"done":"active")}>{x.selecao?.finalizada?"Finalizada":"Em andamento"}</span><button onClick={()=>setSelecaoModal(x.id)} disabled={!x.selecao}>Ver seleção</button></div></article>)}{!dados.pastas.length&&<div className="pw-empty">Nenhuma pasta neste projeto.</div>}</section>}

  {aba==="entrega"&&<section className="pw-section"><div className="pw-section-head"><div><span>ENTREGA</span><h2>{galeriaUnica?"Acompanhe a entrega das fotos":"Acompanhe cada galeria até a publicação"}</h2><p>{galeriaUnica?"As fotos ficam em uma única galeria, no mesmo link do projeto.":"O cliente recebe todas as galerias pelo mesmo link."}</p></div></div><div className="pw-delivery-list">{dados.pastas.map(x=><article key={x.id}><div><strong>{x.titulo}</strong><p>{x.etapa==="entrega"?"Fotos finais publicadas":x.etapa==="preparando_entrega"?"Finais em preparação":x.selecao?.finalizada?"Seleção pronta para edição":p.prova?"Aguardando seleção do cliente":"Entrega direta"}</p></div><button className={x.etapa==="entrega"?"":"primary"} onClick={()=>router.push(`/dashboard/entrega/${x.id}`)} disabled={p.prova&&!x.selecao?.finalizada&&x.etapa!=="preparando_entrega"&&x.etapa!=="entrega"}>{x.etapa==="entrega"?"Revisar":x.etapa==="preparando_entrega"?"Continuar":"Preparar entrega"}</button></article>)}</div></section>}

  {aba==="atividade"&&<section className="pw-section"><div className="pw-section-head"><div><span>ATIVIDADE</span><h2>O que aconteceu no projeto</h2><p>Visualizações, comentários, seleções e downloads aparecem em uma linha do tempo.</p></div></div><div className="pw-timeline">{dados.eventos.length?dados.eventos.map(e=>{const pasta=dados.pastas.find(x=>x.id===e.entidade_id||x.publicRef===e.entidade_id);return <article key={e.id}><i/><div><strong>{EVENTOS[e.evento]||e.evento.replaceAll("_"," ")}</strong><p>{pasta?.titulo||"Projeto"}{typeof e.detalhes?.arquivo==="string"?` · ${e.detalhes.arquivo}`:""}</p></div><time>{data(e.criado_em)}</time></article>}):<div className="pw-empty">As novas interações do cliente aparecerão aqui.</div>}</div></section>}

  {configuracoesAbertas&&<FoturaDrawer size="wide" title="Configurações do projeto" description={`Personalize “${p.nome}” sem sair do projeto.`} onClose={fecharConfiguracoes} suspended={modalCapa||modalExcluirProjeto} footer={
    <div className="pw-settings-savebar"><span>As mudanças são aplicadas depois de salvar.</span><button className="primary pw-save" onClick={()=>void salvarConfiguracoes()} disabled={salvando}><CheckIcon size={16}/>{salvando?"Salvando…":"Salvar alterações"}</button></div>
  }>
  <section className="pw-section pw-settings-section pw-project-settings-drawer-content">
    <div className="pw-settings-drawer-intro"><span>PERSONALIZAÇÃO</span><p>Organize as preferências por assunto. Tudo pode ser salvo de uma vez.</p></div>
    {aviso&&<div className="pw-settings-drawer-notice" role="status">{aviso}</div>}
    <div className="pw-settings-drawer-layout">
    <nav className="pw-config-nav" aria-label="Categorias das configurações">
      {(["projeto","abertura","selecao","entrega","vendas","avancado"] as ConfigSecao[]).map(sec=>
        <button key={sec} type="button" className={configSecao===sec?"on":""} aria-current={configSecao===sec?"page":undefined} onClick={()=>setConfigSecao(sec)}>
          {sec==="projeto"?<FolderIcon size={16}/>:sec==="abertura"?<SparklesIcon size={16}/>:sec==="selecao"?<CheckIcon size={16}/>:sec==="entrega"?<DownloadIcon size={16}/>:sec==="vendas"?<ShoppingBagIcon size={16}/>:<SettingsIcon size={16}/>}
          <span>{sec==="projeto"?"Projeto e acesso":sec==="abertura"?"Abertura":sec==="selecao"?"Seleção":sec==="entrega"?"Entrega":sec==="vendas"?"Fotos extras":"Avançado"}</span>
        </button>)}
    </nav>
    <div className="pw-settings-drawer-main">
    <div className="pw-config-grid" data-active={configSecao}><div className="pw-config-column">
   <div className="pw-config-intro"><ProjectCinematicSettings projeto={id} nome={nome} descricao={descricao} pastas={dados.pastas} value={abertura} onChange={setAbertura} token={token}/></div>
<div className="pw-config-card pw-config-identity"><span>IDENTIDADE</span><h3>Detalhes do projeto</h3><label className="pw-field">Nome<input value={nome} onChange={e=>setNome(e.target.value)}/></label><label className="pw-field">Descrição<textarea value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Opcional"/></label><label className="pw-field">Cliente<select value={clienteId} onChange={e=>setClienteId(e.target.value)}><option value="">Sem cliente vinculado</option>{dados.clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label><div className="pw-cover-config"><div>{p.capaUrl?<img src={p.capaUrl} alt=""/>:<span>Sem capa</span>}</div><button onClick={()=>void abrirCapa()} disabled={!dados.pastas.length}>Escolher capa do projeto</button></div><p className="pw-note">A imagem aparece na prévia do link compartilhado e nas galerias que ainda não têm uma capa própria.</p>
    {(p.tem_senha||Boolean(senha.trim()))?
      <div className="pw-og-permission"><Toggle label="Mostrar capa no compartilhamento, mesmo com senha" value={ogCapaAutorizada} set={setOgCapaAutorizada}/>
      <p className="pw-note">Se ativar, qualquer pessoa que receber o link poderá ver somente a capa na prévia, antes de digitar a senha. Essa imagem também pode ficar salva no cache do WhatsApp depois de você desativar a opção.</p></div>
      :<p className="pw-note">Este projeto não exige senha: a capa será mostrada automaticamente na prévia. Se adicionar uma senha, escolha explicitamente se deseja continuar exibindo a capa.</p>}
    </div>
</div><div className="pw-config-column"><div className="pw-config-card pw-config-proof"><span>ESCOLHAS DO CLIENTE</span><h3>Seleção de fotografias</h3><Toggle label="Permitir que o cliente escolha as fotos" value={prova} set={setProva}/><label className="pw-field">{galeriaUnica?"Limite de fotos":"Limite de fotos por galeria"}<input type="number" min="0" value={limite} onChange={e=>setLimite(e.target.value)}/><small>{galeriaUnica?"0 = sem limite.":"0 = sem limite. O limite vale para cada galeria."}</small></label><label className="pw-field">Prazo da seleção<input type="date" value={prazo} onChange={e=>setPrazo(e.target.value)}/></label></div>
<div className="pw-config-card pw-config-access"><span>PRIVACIDADE</span><h3>Link e acesso do cliente</h3><p className="pw-note">Defina até quando o link funciona e se será necessário uma senha para abrir o projeto.</p><label className="pw-field">Validade do link<input type="date" value={linkAte} onChange={e=>setLinkAte(e.target.value)}/></label><label className="pw-field">Nova senha <small>{p.tem_senha?"Senha configurada. Deixe vazio para manter.":"Opcional"}</small><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder={p.tem_senha?"••••••":"Senha do projeto"}/></label>{p.tem_senha&&<button className="danger-lite" onClick={()=>void removerSenha()}>Remover senha</button>}</div>
<div className="pw-config-card pw-config-downloads"><span>ENTREGA</span><h3>Downloads das fotografias</h3><Toggle label="Permitir downloads" value={downloadAtivo} set={setDownloadAtivo}/><Toggle label="Foto individual" value={downloadIndividual} set={setDownloadIndividual} disabled={!downloadAtivo}/><Toggle label={galeriaUnica?"Baixar galeria completa":"Baixar galeria completa"} value={downloadCompleto} set={setDownloadCompleto} disabled={!downloadAtivo}/><div className="pw-original-delivery-notice"><strong>Qualidade máxima · arquivos originais</strong><p>O cliente navega pelas prévias otimizadas, mas todo download contém a fotografia original, sem recompressão nem redução de resolução.</p></div><label className="pw-field">Novo PIN <small>{p.download_pin_configurado?"PIN configurado. Deixe vazio para manter.":"Opcional · 4 a 8 dígitos"}</small><input inputMode="numeric" value={downloadPin} onChange={e=>setDownloadPin(e.target.value.replace(/\D/g,"").slice(0,8))}/></label>{p.download_pin_configurado&&<button className="danger-lite" onClick={()=>void removerPin()}>Remover PIN</button>}</div>
<div className="pw-config-card pw-config-protection"><span>EXPERIÊNCIA DO CLIENTE</span><h3>Ajuda ao cliente</h3><p className="pw-note">Para permitir que o cliente escolha fotos antes de recebê-las, utilize um projeto de seleção. As prévias são exibidas normalmente, sem permitir baixar originais antes da entrega.</p><Toggle label="Guia na primeira visita" value={assistenteAtivo} set={setAssistenteAtivo}/></div>
<div className="pw-config-card pw-config-extras"><span>OPCIONAL</span><h3>Venda de fotografias adicionais</h3><Toggle label="Permitir compra de fotos adicionais" value={vendaExtras&&dados.comercial.vendaFotosDisponivel} set={setVendaExtras} disabled={!dados.comercial.vendaFotosDisponivel}/><label className="pw-field">Preço por foto extra<input value={precoExtra} onChange={e=>setPrecoExtra(e.target.value.replace(/[^0-9,.]/g,""))} placeholder="Ex: 8,00" disabled={!vendaExtras||!dados.comercial.vendaFotosDisponivel}/></label>{dados.comercial.vendaFotosDisponivel?<p className="pw-note">A compra de fotos extras está pronta para uso neste projeto.</p>:<p className="pw-note commercial-warning">{!dados.comercial.assinaturaAtiva?"Fotos extras pagas exigem um plano ativo.":!dados.comercial.stripeRecebimentosAtivo?"Conecte os recebimentos pelo Stripe antes de ativar vendas de fotos extras.":"As vendas de fotos extras ainda não estão disponíveis nesta conta."}</p>}</div>
  </div></div>
  {configSecao==="avancado"&&<div className="pw-config-advanced-note"><SettingsIcon size={18}/><p>Estas ações são permanentes e não afetam as demais configurações até que você as confirme.</p></div>}
  {configSecao==="avancado"&&<div className="pw-danger-zone"><div><span>ZONA DE PERIGO</span><h3>Excluir este projeto</h3><p>Remove permanentemente o projeto e suas {dados.pastas.length} galeria{dados.pastas.length===1?"":"s"}, {totalFotos} foto{totalFotos===1?"":"s"}, seleções, comentários, entregas e dados associados.</p></div><button type="button" onClick={()=>{setConfirmacaoProjeto("");setModalExcluirProjeto(true)}}>Excluir projeto</button></div>}
  </div>
  </div>
  </section></FoturaDrawer>}

  {aba==="vendas"&&<section className="pw-section"><div className="pw-sales-summary"><div><span>Volume pago</span><strong>{dinheiro(receita,dados.vendas[0]?.moeda||"brl")}</strong></div><div><span>Fotos extras</span><strong>{extras}</strong></div><div><span>Vendas</span><strong>{vendasPagas.length}</strong></div></div><div className="pw-sales-list">{dados.vendas.length?dados.vendas.map(v=>{const pasta=dados.pastas.find(x=>x.id===v.galeria);return <article key={v.id}><div><strong>{pasta?.titulo||"Pasta"}</strong><p>{v.qtd_extras} foto{v.qtd_extras===1?"":"s"} extra{v.qtd_extras===1?"":"s"} · {data(v.criado_em)}</p></div><div><strong>{dinheiro(v.valor_total_centavos,v.moeda)}</strong><span className={"sale-"+v.status}>{v.status}</span></div></article>}):<div className="pw-empty">Nenhuma venda registrada neste projeto.</div>}</div></section>}
 </main>

 {pastaNoPainel&&<FolderSettingsDrawer
    pasta={pastaNoPainel} prova={p.prova}
    saving={salvandoPasta===pastaNoPainel.id||reordenandoPastas}
    onClose={()=>setPastaDetalhes(null)}
    onRename={async novoNome=>{
      await post({acao:"atualizar_pasta",projetoId:id,pastaId:pastaNoPainel.id,nome:novoNome});
      setDados(atual=>atual?{...atual,pastas:atual.pastas.map(x=>x.id===pastaNoPainel.id?{...x,titulo:novoNome}:x)}:atual);
      setAviso("Nome da pasta atualizado.");
    }}
    onVisibility={()=>alternarVisibilidadePasta(pastaNoPainel)}
    onCover={()=>{setPastaDetalhes(null);void abrirCapa(pastaNoPainel.id,true)}}
    onManage={()=>{setPastaDetalhes(null);setGerenciadorPasta(pastaNoPainel.id)}}
    onAction={()=>{setPastaDetalhes(null);abrirAcaoPasta(pastaNoPainel)}}
    actionLabel={rotuloAcaoPasta(pastaNoPainel)}
    onProjectSettings={()=>{setPastaDetalhes(null);abrirConfiguracoes()}}
  />}
 {gerenciadorPasta&&<ProjectPhotoManager projetoId={id} galeriaUnica={galeriaUnica} pastas={dados.pastas.map(x=>({id:x.id,titulo:x.titulo,etapa:x.etapa,qtd:x.qtd}))} pastaInicial={gerenciadorPasta} fechar={()=>setGerenciadorPasta(null)} atualizar={()=>{void carregar()}}/>}
 <ProjectShareCenter aberto={compartilharAberto} galeriaUnica={galeriaUnica} fechar={()=>setCompartilharAberto(false)} nome={p.nome} url={publicUrl} cliente={dados.cliente?.nome??null} protegido={p.tem_senha} linkAte={p.link_ate} prova={p.prova} downloadAtivo={p.download_ativo} downloadIndividual={p.download_individual} downloadCompleto={p.download_completo} downloadTamanho={p.download_tamanho} downloadPin={p.download_pin_configurado} pastas={dados.pastas} copiar={()=>{void copiarLinkProjeto();setCompartilharAberto(false)}} configurar={()=>{setCompartilharAberto(false);abrirConfiguracoes()}}/>
 {modalPasta&&!galeriaUnica&&<div className="pw-modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!criandoPasta)setModalPasta(false)}}><form className="pw-modal-card" onSubmit={criarPasta}><div className="pw-modal-head"><div><span>NOVA GALERIA</span><h2>Organize mais fotografias</h2><p>Esta galeria será exibida dentro do mesmo link do projeto.</p></div><button type="button" onClick={()=>setModalPasta(false)} disabled={criandoPasta}><CloseIcon size={18}/></button></div><label className="pw-field">Nome da galeria<input autoFocus value={nomePasta} onChange={e=>setNomePasta(e.target.value)} placeholder="Ex.: Bastidores, Retratos ou Destaques" required/></label><div className="pw-modal-actions"><button type="button" onClick={()=>setModalPasta(false)} disabled={criandoPasta}>Cancelar</button><button className="primary" type="submit" disabled={!nomePasta.trim()||criandoPasta}>{criandoPasta?"Criando…":"Criar galeria e adicionar fotos"}</button></div></form></div>}

 {modalExcluirProjeto&&<div className="pw-modal pw-project-modal-above-drawer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!excluindoProjeto){setModalExcluirProjeto(false);setConfirmacaoProjeto("")}}}><div className="pw-modal-card pw-danger-modal" role="dialog" aria-modal="true" aria-labelledby="pw-delete-project-title" onKeyDown={e=>{if(e.key==="Escape"&&!excluindoProjeto){setModalExcluirProjeto(false);setConfirmacaoProjeto("")}}}><div className="pw-modal-head"><div><span>ZONA DE PERIGO</span><h2 id="pw-delete-project-title">Excluir “{p.nome}”?</h2><p>Esta ação não pode ser desfeita. Todas as galerias, fotos, thumbnails, seleções, comentários, entregas e vendas relacionadas a este Projeto serão removidas.</p></div><button type="button" onClick={()=>{setModalExcluirProjeto(false);setConfirmacaoProjeto("")}} disabled={excluindoProjeto}><CloseIcon size={18}/></button></div><div className="pw-danger-summary"><strong>{dados.pastas.length} galeria{dados.pastas.length===1?"":"s"} · {totalFotos} foto{totalFotos===1?"":"s"}</strong><span>O link público do Projeto também deixará de funcionar imediatamente.</span></div><label className="pw-field pw-confirm-field">Para confirmar, digite exatamente <b>{p.nome}</b><input autoFocus autoComplete="off" value={confirmacaoProjeto} onChange={e=>setConfirmacaoProjeto(e.target.value)} placeholder={p.nome}/></label><div className="pw-modal-actions"><button type="button" onClick={()=>{setModalExcluirProjeto(false);setConfirmacaoProjeto("")}} disabled={excluindoProjeto}>Cancelar</button><button type="button" className="pw-delete-project" onClick={()=>void confirmarExclusaoProjeto()} disabled={excluindoProjeto||confirmacaoProjeto.trim()!==p.nome}>{excluindoProjeto?"Excluindo…":"Excluir projeto permanentemente"}</button></div></div></div>}

 <ConfirmDialog open={Boolean(excluirPasta)} title={excluirPasta?`Excluir “${excluirPasta.titulo}”?`:"Excluir pasta?"} description={excluirPasta?`Esta ação é permanente: ${excluirPasta.qtd} foto${excluirPasta.qtd===1?"":"s"}, seleção, comentários e dados de entrega desta pasta serão excluídos. Se ela estiver sendo usada como origem da capa do Projeto, a capa também será removida.`:""} confirmLabel="Excluir pasta" cancelLabel="Cancelar" danger loading={excluindoPasta} onConfirm={()=>void confirmarExclusaoPasta()} onCancel={()=>{if(!excluindoPasta)setExcluirPasta(null)}}/>

 {selecaoModal&&dados.pastas.find(x=>x.id===selecaoModal)?.selecao&&<ModalSelecao uid={p.user_id} galeriaId={selecaoModal} titulo={dados.pastas.find(x=>x.id===selecaoModal)?.titulo||"Pasta"} selecao={dados.pastas.find(x=>x.id===selecaoModal)!.selecao!} onFechar={()=>setSelecaoModal(null)}/>}
 {modalCapa&&<div className="pw-modal pw-project-modal-above-drawer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!salvandoCapa)setModalCapa(false)}}><div className="pw-modal-card pw-cover-modal" role="dialog" aria-modal="true" aria-label={capaIndividual?"Escolher capa da galeria":"Escolher capa do projeto"} onKeyDown={e=>{if(e.key==="Escape"&&!salvandoCapa){e.stopPropagation();setModalCapa(false)}}}><div className="pw-modal-head"><div><span>{capaIndividual?"CAPA DA PASTA":"CAPA DO PROJETO"}</span><h2>{capaIndividual?dados.pastas.find(x=>x.id===pastaCapa)?.titulo:"Escolha uma foto de qualquer pasta"}</h2><p>{capaIndividual?"Escolha a foto que representa esta pasta.":"Usada nas pastas que ainda não têm uma capa própria."}</p></div><button type="button" onClick={()=>setModalCapa(false)} disabled={salvandoCapa}><CloseIcon size={18}/></button></div>{capaIndividual&&dados.pastas.find(x=>x.id===pastaCapa)?.capa&&<button className="pw-cover-reset" type="button" disabled={salvandoCapa} onClick={()=>void removerCapaPasta()}>Usar capa do projeto</button>}{!capaIndividual&&<label className="pw-field">Pasta<select value={pastaCapa} onChange={e=>void carregarFotosCapa(e.target.value)}>{dados.pastas.map(x=><option key={x.id} value={x.id}>{x.titulo}</option>)}</select></label>}{carregandoCapa?<div className="pw-empty">Carregando fotos…</div>:fotosCapa.length?<div className="pw-cover-grid">{fotosCapa.map(f=><button type="button" key={f.nome} aria-label={`Usar ${f.nome} como capa`} aria-pressed={capaIndividual?dados.pastas.find(x=>x.id===pastaCapa)?.capa===f.nome:p.capa_arquivo===f.nome&&p.capa_galeria_id===pastaCapa} onClick={()=>void definirCapa(f)} disabled={salvandoCapa}><img src={f.url} alt="" loading="lazy"/><span>{f.nome}</span></button>)}</div>:<div className="pw-empty">Esta pasta ainda não tem fotos.</div>}</div></div>}
 </div>
}

function Toggle({label,value,set,disabled}:{label:string;value:boolean;set:(v:boolean)=>void;disabled?:boolean}){return <label className={"pw-toggle"+(disabled?" disabled":"")}><input type="checkbox" checked={value} onChange={e=>set(e.target.checked)} disabled={disabled}/><span/><b>{label}</b></label>}

const css=`
.pw-cover-reset{margin:0 0 18px;padding:10px 14px;border:1px solid var(--ft-border);border-radius:10px;background:var(--ft-surface);color:var(--ft-accent-ink);cursor:pointer}.pw-cover-grid button[aria-pressed="true"]{outline:3px solid #7c68ae;outline-offset:2px}

.pw-page{min-height:100vh;background:linear-gradient(180deg,var(--ft-bg-start),var(--ft-bg-end));color:var(--ft-text)}
.pw-shell{max-width:1120px;margin:0 auto;padding:40px 40px 80px}
.pw-state{min-height:100vh;display:grid;place-items:center;padding:24px;color:#74788f}.pw-state-card{width:min(440px,100%);box-sizing:border-box;padding:26px;border:1px solid var(--ft-border);border-radius:var(--ft-radius-panel);background:var(--ft-surface);box-shadow:var(--ft-shadow-card);text-align:center}.pw-state-card strong{display:block;color:var(--ft-text);font-size:18px}.pw-state-card span{display:block;margin-top:8px;color:var(--ft-text-muted);font-size:var(--ft-font-sm);line-height:1.55}.pw-state-card>div{display:flex;justify-content:center;gap:8px;margin-top:20px;flex-wrap:wrap}.pw-state-card button{min-height:38px;border:0;border-radius:var(--ft-radius-control);background:var(--ft-brand-gradient);color:#fff;padding:0 12px;font:700 var(--ft-font-sm) inherit;cursor:pointer}.pw-state-card button.secondary{border:1px solid var(--ft-border);background:var(--ft-surface-muted);color:var(--ft-accent-ink)}
.pw-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:20px}
.pw-head-copy{min-width:0}
.pw-back{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0;color:#675b9d;font-size:var(--ft-font-sm);font-weight:700;font-family:inherit;cursor:pointer}
.pw-head p{margin:10px 0 5px;color:#6f76a0;font-size:10px;font-weight:700;letter-spacing:1.8px}
.pw-head h1{max-width:760px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:30px;font-weight:600;letter-spacing:-.65px}
.pw-status{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.pw-status span{padding:4px 7px;border:1px solid #ddd7e8;border-radius:999px;background:rgba(250,248,253,.7);color:#74788c;font-size:var(--ft-font-xs);font-weight:700}
.pw-head-actions{display:flex;align-items:center;gap:7px;flex:none}
.pw-head-actions>button,.pw-section button,.pw-head-buttons button,.pw-overview-card button{min-height:36px;border:1px solid #d0c7e2;border-radius:var(--ft-radius-control);background:var(--ft-surface);color:#4a5067;padding:0 11px;font-size:var(--ft-font-sm);font-weight:700;font-family:inherit;text-decoration:none;cursor:pointer}
.pw-head-actions button:disabled,.pw-section button:disabled,.pw-overview-card button:disabled{opacity:.48;cursor:default}
.primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0!important;background:linear-gradient(90deg,var(--ft-brand-blue),var(--ft-brand-purple))!important;color:#fff!important}
.pw-notice{margin-bottom:14px;padding:9px 11px;border:1px solid #d7cee8;border-radius:var(--ft-radius-control);background:#f8f5fb;color:#5e637a;font-size:var(--ft-font-sm)}
.pw-tabs{display:flex;align-items:center;gap:22px;overflow:auto;margin-bottom:18px;border-bottom:1px solid var(--ft-border)}
.pw-tabs button{position:relative;flex:none;border:0;background:transparent;padding:10px 1px 11px;color:#777c91;font-size:var(--ft-font-sm);font-weight:700;font-family:inherit;cursor:pointer}
.pw-tabs button.on{color:#2e354d}
.pw-tabs button.on:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:999px;background:#5d67a7}
.pw-tabs button.secondary{margin-left:auto;color:var(--ft-accent-ink)}
.pw-overflow-wrap{position:relative;display:inline-flex}
.pw-more{display:inline-grid;place-items:center;width:38px;min-width:38px!important;height:36px!important;min-height:36px!important;padding:0!important;border:1px solid #d0c7e2!important;border-radius:var(--ft-radius-control)!important;background:var(--ft-surface)!important;color:#555c74!important;font:800 14px/1 inherit!important;letter-spacing:1px;cursor:pointer}
.pw-more:hover,.pw-more.open{border-color:#bfb4d8!important;background:#f1edf7!important;color:#40395f!important}
.pw-more.folder{width:34px;min-width:34px!important;height:32px!important;min-height:32px!important;border-radius:var(--ft-radius-control)!important;background:#f8f5fb!important}
.pw-overflow-menu{position:absolute;right:0;top:calc(100% + 7px);z-index:50;display:grid;min-width:220px;padding:5px;border:1px solid #d8d1e7;border-radius:var(--ft-radius-card);background:#fbfafd;box-shadow:0 16px 36px rgba(43,35,72,.15)}
.pw-overflow-menu button,.pw-overflow-menu a{display:flex;align-items:center;width:100%;min-height:34px;box-sizing:border-box;border:0!important;border-radius:var(--ft-radius-control)!important;background:transparent!important;color:#535a72!important;padding:7px 9px!important;font-size:var(--ft-font-sm)!important;font-weight:600!important;font-family:inherit!important;text-decoration:none;text-align:left;cursor:pointer}
.pw-overflow-menu button:hover,.pw-overflow-menu a:hover,.pw-overflow-menu button.active{background:#efebf7!important;color:#30294f!important}
.pw-overflow-menu button:disabled{opacity:.42;cursor:default}
.pw-overflow-menu .danger{color:#a44755!important}
.pw-overflow-menu .danger:hover{background:#f8e9eb!important;color:#8d3342!important}
.pw-menu-sep{height:1px;margin:4px 5px;background:#e4deeb}
.pw-overflow-menu.folder{min-width:190px}

.pw-overview-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.85fr);gap:12px}
.pw-overview-card,.pw-section{border:1px solid #dcd6e8;border-radius:14px;background:#fcfafe;box-shadow:0 7px 22px rgba(57,46,91,.035)}
.pw-single-gallery{display:grid;grid-template-columns:200px minmax(0,1fr);align-items:stretch;gap:20px;padding:14px;border:1px solid #e0d9eb;border-radius:14px;background:#faf8fe}
.pw-single-cover{min-height:162px;overflow:hidden;border-radius:10px;border:1px solid #dfd7ee;background:linear-gradient(145deg,#eee9f8,#e7e4f2);display:grid;place-items:center;color:#8a7dae}
.pw-single-cover img{width:100%;height:100%;object-fit:cover}
.pw-single-copy{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:8px}
.pw-single-copy>span{font-size:10px;font-weight:800;letter-spacing:.12em;color:#786a9e}
.pw-single-copy h3{font-size:19px;margin:0;color:#2b3047}
.pw-single-copy p{font-size:12px;color:#777d93;margin:0}
.pw-single-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.pw-single-actions button{display:inline-flex;align-items:center;gap:6px;min-height:37px}
@media(max-width:640px){.pw-single-gallery{grid-template-columns:1fr;gap:14px}.pw-single-cover{min-height:190px}.pw-single-actions button{flex:1;justify-content:center}}
.pw-overview-card{padding:15px}
.pw-project-summary{display:grid;grid-template-columns:170px minmax(0,1fr);gap:16px;align-items:stretch}
.pw-summary-cover{position:relative;min-height:118px;border:1px solid #ddd6e8;border-radius:var(--ft-radius-card);overflow:hidden;background:#eeeaf5;display:grid;place-items:center;color:#898c9e;font-size:var(--ft-font-xs)}
.pw-summary-cover img{width:100%;height:100%;object-fit:cover}
.pw-summary-copy{align-self:center;min-width:0}
.pw-summary-copy>span,.pw-card-head span,.pw-section-head span,.pw-config-card>span,.pw-modal-head span{font-size:var(--ft-font-xs);text-transform:uppercase;letter-spacing:.14em;font-weight:800;color:#777096}
.pw-summary-copy h2,.pw-card-head h2{margin:5px 0 5px;font-size:18px;letter-spacing:-.25px}
.pw-summary-copy>p,.pw-client-link-card>p{margin:0;color:#7b8093;font-size:var(--ft-font-sm);line-height:1.5}
.pw-summary-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
.pw-summary-meta span{padding:4px 6px;border-radius:999px;background:#f0ecf6;color:#70758a;font-size:var(--ft-font-xs);font-weight:700}
.pw-link-button{display:inline-flex;align-items:center;gap:5px;min-height:0!important;margin-top:12px;padding:0!important;border:0!important;background:transparent!important;color:#5d5290!important}
.pw-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.pw-card-head img{width:54px;height:54px;flex:none;padding:4px;border:1px solid #e0d9eb;border-radius:var(--ft-radius-control);background:#fff}
.pw-share{display:flex;gap:6px;margin-top:13px}
.pw-share code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:9px;border:1px solid #ddd6e9;border-radius:var(--ft-radius-control);background:#f4f0f8;color:#656a7f;font-size:var(--ft-font-xs)}
.pw-share button{min-height:34px!important}
.pw-client-link-card>p{margin-top:9px}
.pw-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
.pw-metrics button{display:grid;justify-items:start;gap:2px;padding:12px 13px;border:1px solid #ded8e9;border-radius:var(--ft-radius-card);background:rgba(250,248,253,.82);color:#30354b;text-align:left;cursor:pointer;transition:border-color .16s,background .16s,transform .16s}
.pw-metrics button:hover{transform:translateY(-1px);border-color:#c9bfdd;background:#fcfbfe}
.pw-metrics strong{font-size:20px;letter-spacing:-.35px}
.pw-metrics span{font-size:var(--ft-font-xs);font-weight:800;color:#555b71}
.pw-metrics small{font-size:var(--ft-font-xs);color:#8a8d9e}

.pw-section{padding:18px}
.pw-section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:15px}
.pw-section-head h2{margin:5px 0 4px;font-size:17px;letter-spacing:-.2px}
.pw-section-head p{margin:0;color:#7b7f92;font-size:var(--ft-font-sm)}
.pw-head-buttons{display:flex;gap:6px}
.pw-folder-summary{display:flex;align-items:center;gap:8px}
.pw-folder-summary small{color:#7d8193;font-size:var(--ft-font-xs);white-space:nowrap}
.pw-folder-list{display:grid;gap:7px}
.pw-folder{position:relative;display:grid;grid-template-columns:58px minmax(180px,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid #e0dae9;border-radius:10px;background:#fcfbfe;transition:opacity .16s,border-color .16s,box-shadow .16s,transform .16s}
.pw-folder:hover{border-color:#cec5df}
.pw-folder.hidden{background:#f7f4f9;border-style:dashed;opacity:.76}
.pw-folder.dragging{opacity:.48;border-color:#a99ccb;box-shadow:0 10px 26px rgba(57,46,91,.11);transform:scale(.995)}
.pw-folder-cover{position:relative;width:56px;height:42px;overflow:hidden;border:1px solid #ddd6e8;border-radius:var(--ft-radius-control);background:#f0ecf6;color:#fff;cursor:grab}
.pw-folder-cover:active{cursor:grabbing}
.pw-folder-cover img{display:block;width:100%;height:100%;object-fit:cover}
.pw-folder-cover-empty{display:grid;place-items:center;position:absolute;inset:0;display:grid;place-items:center;color:#aaa4b7;font-size:16px}
.pw-folder-cover-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,12,25,.02),rgba(12,12,25,.42))}
.pw-folder-cover b{position:absolute;right:5px;bottom:4px;z-index:2;padding:2px 4px;border-radius:999px;background:rgba(20,20,35,.58);color:#fff;font-size:var(--ft-font-xs);letter-spacing:.04em;backdrop-filter:blur(5px)}
.pw-folder-cover .pw-drag{display:grid;place-items:center;position:absolute;left:5px;bottom:5px;z-index:2;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.45)}
.pw-drag{font-size:13px;letter-spacing:-3px;transform:rotate(90deg);opacity:.78}
.pw-folder-copy{min-width:0}
.pw-folder-title{display:flex;align-items:center;gap:6px;min-width:0}
.pw-folder-copy strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--ft-font-sm)}
.pw-folder-copy p{margin:3px 0 0;color:#818598;font-size:var(--ft-font-xs)}
.pw-visibility{flex:none;padding:3px 6px;border:1px solid;border-radius:999px;font-size:var(--ft-font-xs);font-weight:800}
.pw-visibility.published{color:var(--ft-success);border-color:#c9e4d5;background:#edf7f2}
.pw-visibility.hidden{color:#79758a;border-color:#d8d2df;background:#efebf2}
.pw-folder-edit{display:flex;align-items:center;gap:5px}
.pw-folder-edit input{min-width:0;flex:1;height:32px;box-sizing:border-box;border:1px solid #cfc6df;border-radius:var(--ft-radius-control);padding:0 9px;background:#fff;color:#30354a;font-size:var(--ft-font-sm);font-weight:700;font-family:inherit;outline:none}
.pw-folder-edit input:focus{border-color:#9f90cb;box-shadow:0 0 0 3px rgba(95,78,164,.09)}
.pw-folder-edit button{min-height:32px!important}
.pw-folder-edit .save{border-color:#c6bce0!important;background:#eee8f7!important;color:var(--ft-accent-ink)!important}
.pw-folder-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}
.pw-folder-primary{min-height:32px!important;border-color:#cbc0e2!important;background:#f1ecf8!important;color:var(--ft-accent-ink)!important}
.pw-pill{display:inline-flex;padding:4px 7px;border:1px solid;border-radius:999px;font-size:var(--ft-font-xs);font-weight:800;white-space:nowrap}
.pw-pill.active{color:#97702d;background:#fbf2db;border-color:#e8d4a0}
.pw-pill.prep{color:#527a9a;background:#eaf4fb;border-color:#c9dfee}
.pw-pill.done{color:var(--ft-success);background:#e9f5ef;border-color:#c9e4d5}
.pw-empty{padding:38px 16px;text-align:center;color:#7a7f92;font-size:var(--ft-font-sm)}
.pw-empty strong{display:block;color:#33384d;font-size:14px}
.pw-empty p{margin:6px 0 12px}
.pw-selection,.pw-delivery-list article,.pw-sales-list article{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 2px;border-bottom:1px solid #e5dfeb}
.pw-selection:last-child,.pw-delivery-list article:last-child,.pw-sales-list article:last-child{border-bottom:0}
.pw-selection strong,.pw-delivery-list strong,.pw-sales-list strong{font-size:var(--ft-font-sm)}
.pw-selection-actions{display:flex;align-items:center;gap:7px}
.pw-selection p,.pw-delivery-list p,.pw-sales-list p{margin:3px 0 0;color:#818598;font-size:var(--ft-font-xs)}
.pw-timeline article{display:grid;grid-template-columns:13px 1fr auto;gap:9px;align-items:center;padding:11px 0;border-bottom:1px solid #e5dfeb}
.pw-timeline i{width:7px;height:7px;border-radius:50%;background:#6856b0;box-shadow:0 0 0 3px #ebe5f5}
.pw-timeline strong{font-size:var(--ft-font-sm)}
.pw-timeline p{margin:3px 0 0;color:#7b7f91;font-size:var(--ft-font-xs)}
.pw-timeline time{font-size:var(--ft-font-xs);color:#8a8d9e}

.pw-config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
.pw-config-column{display:flex;flex-direction:column;gap:14px;min-width:0}
.pw-config-column>.pw-config-card{width:100%;box-sizing:border-box;min-width:0}
.pw-config-card{padding:15px;border:1px solid #e0dae9;border-radius:var(--ft-radius-card);background:#f8f5fb}
.pw-config-card h3{margin:5px 0 12px;font-size:14px}
.pw-field{display:grid;gap:5px;margin:9px 0;color:#62677d;font-size:var(--ft-font-xs);font-weight:700}
.pw-field small{font-weight:500;color:#9092a2}
.pw-field input:not([type=range]),.pw-field select,.pw-field textarea{width:100%;box-sizing:border-box;min-height:36px;padding:0 9px;border:1px solid #d6cfe3;border-radius:var(--ft-radius-control);background:#fff;color:#33384d;outline:none}
.pw-field textarea{min-height:66px;padding:9px;resize:vertical}
.pw-field input[type=range]{width:100%}
.pw-toggle{display:flex;align-items:center;gap:8px;margin:9px 0;cursor:pointer}
.pw-toggle input{display:none}
.pw-toggle span{width:32px;height:18px;border-radius:999px;background:#cec8d9;position:relative}
.pw-toggle span:after{content:"";position:absolute;width:14px;height:14px;left:2px;top:2px;border-radius:50%;background:#fff;transition:.15s}
.pw-toggle input:checked+span{background:#6756b0}
.pw-toggle input:checked+span:after{transform:translateX(14px)}
.pw-toggle b{font-size:10px}
.pw-toggle.disabled{opacity:.45}
.pw-note{color:var(--ft-text-muted);font-size:var(--ft-font-xs);line-height:1.5}.pw-note.commercial-warning{padding:8px 9px;border:1px solid #ead9b8;border-radius:var(--ft-radius-control);background:#fff8e9;color:#7d6537}
.danger-lite{color:#a24e5c!important}
.pw-save{margin-top:14px;min-width:220px}
.pw-cover-config{display:flex;align-items:center;gap:9px;margin-top:11px}
.pw-cover-config>div{width:70px;height:49px;border:1px solid #ddd6e8;border-radius:var(--ft-radius-control);overflow:hidden;background:#eeeaf5;display:grid;place-items:center;color:#898c9e;font-size:var(--ft-font-xs)}
.pw-cover-config img{width:100%;height:100%;object-fit:cover}
.pw-danger-zone{display:flex;align-items:center;justify-content:space-between;gap:22px;margin-top:22px;padding:16px 17px;border:1px solid #e7c6cb;border-radius:var(--ft-radius-card);background:#fbf3f4}
.pw-danger-zone>div{min-width:0}
.pw-danger-zone span{display:block;color:#a24e5c;font-size:var(--ft-font-xs);font-weight:800;letter-spacing:.14em}
.pw-danger-zone h3{margin:5px 0 4px;color:#6f2f39;font-size:13px}
.pw-danger-zone p{max-width:700px;margin:0;color:#8b6268;font-size:var(--ft-font-xs);line-height:1.55}
.pw-danger-zone button,.pw-delete-project{flex:none;min-height:36px;border:1px solid #c7707c!important;border-radius:var(--ft-radius-control);background:#b4232f!important;color:#fff!important;padding:0 12px;font-size:var(--ft-font-sm);font-weight:700;font-family:inherit;cursor:pointer}
.pw-danger-zone button:hover,.pw-delete-project:hover:not(:disabled){background:#9f1f2a!important}
.pw-delete-project:disabled{opacity:.45;cursor:not-allowed}
.pw-danger-modal{border-color:#e1bcc2}
.pw-danger-summary{display:grid;gap:4px;padding:11px 12px;border:1px solid #ead1d5;border-radius:var(--ft-radius-control);background:#fbf3f4}
.pw-danger-summary strong{color:#71343d;font-size:var(--ft-font-sm)}
.pw-danger-summary span{color:#8d6970;font-size:var(--ft-font-xs);line-height:1.45}
.pw-confirm-field b{color:#71343d}
.pw-sales-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.pw-sales-summary div{padding:13px;border:1px solid #e0dae9;border-radius:10px;background:#f8f5fb}
.pw-sales-summary span{display:block;color:#85889a;font-size:var(--ft-font-xs)}
.pw-sales-summary strong{display:block;margin-top:4px;font-size:17px}
.pw-sales-list article>div:last-child{display:grid;justify-items:end;gap:3px}
.pw-sales-list article span{font-size:var(--ft-font-xs);text-transform:uppercase}
.sale-pago{color:#347252}.sale-pendente{color:#8b6d24}.sale-falhou,.sale-cancelado{color:#a2505b}

.pw-modal{position:fixed;inset:0;z-index:130;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(20,18,31,.58);backdrop-filter:blur(8px)}
.pw-modal-card{width:min(500px,100%);max-height:88vh;overflow:auto;box-sizing:border-box;padding:19px;border:1px solid #d8d1e7;border-radius:14px;background:var(--ft-surface);box-shadow:0 28px 80px rgba(31,25,53,.26)}
.pw-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #e3deeb}
.pw-modal-head h2{margin:5px 0 3px;font-size:18px}
.pw-modal-head p{margin:0;color:var(--ft-text-muted);font-size:10px;line-height:1.5}
.pw-modal-head>button{width:32px;height:32px;border:1px solid var(--ft-border);border-radius:50%;background:var(--ft-surface-muted);color:#656b82;font-size:19px;cursor:pointer}
.pw-modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:16px}
.pw-cover-modal{width:min(780px,100%)}
.pw-cover-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
.pw-cover-grid button{position:relative;aspect-ratio:1;border:2px solid transparent;border-radius:var(--ft-radius-control);overflow:hidden;padding:0;background:#eeeaf5;cursor:pointer}
.pw-cover-grid button:hover{border-color:#6756b0}
.pw-cover-grid img{width:100%;height:100%;object-fit:cover}
.pw-cover-grid span{position:absolute;left:0;right:0;bottom:0;padding:15px 5px 5px;background:linear-gradient(transparent,rgba(10,10,20,.7));color:#fff;font-size:var(--ft-font-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

@media(max-width:1120px){
 .pw-overview-grid{grid-template-columns:1fr}
 .pw-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
 .pw-folder{grid-template-columns:58px minmax(0,1fr) auto}
 .pw-folder-actions{grid-column:2/-1;justify-content:flex-end}
}
@media(max-width:720px){
 .pw-shell{box-sizing:border-box;width:100%;min-width:0;padding:76px 14px 56px}
 .pw-head{align-items:flex-start;flex-direction:column;gap:14px}
 .pw-head h1{white-space:normal;font-size:24px}
 .pw-head-actions{width:100%;justify-content:flex-end}
 .pw-head-actions>.primary{flex:1}
 .pw-tabs{gap:16px}
 .pw-overview-grid{grid-template-columns:minmax(0,1fr);min-width:0}
 .pw-overview-card,.pw-project-summary,.pw-summary-copy{min-width:0;max-width:100%;box-sizing:border-box}
 .pw-project-summary{grid-template-columns:minmax(0,1fr);gap:14px}
 .pw-summary-cover{display:block;box-sizing:border-box;width:100%;max-width:100%;height:clamp(190px,55vw,270px);min-height:0;overflow:hidden}
 .pw-summary-cover img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}
 .pw-summary-copy{overflow-wrap:anywhere}
 .pw-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
 .pw-section{padding:14px}
 .pw-section-head{align-items:flex-start;flex-direction:column}
 .pw-folder-summary{width:100%;justify-content:space-between}
 .pw-folder{grid-template-columns:58px minmax(0,1fr)}
 .pw-folder>.pw-pill{grid-column:2}
 .pw-folder-actions{grid-column:1/-1;justify-content:flex-end;padding-top:7px;border-top:1px solid #ebe5f0}
 .pw-folder-primary{flex:1;max-width:220px}
 .pw-folder-edit{align-items:stretch;flex-wrap:wrap}
 .pw-folder-edit input{flex-basis:100%}
 .pw-head-buttons{width:100%}
 .pw-head-buttons button{flex:1}
 .pw-selection,.pw-delivery-list article{align-items:flex-start;flex-direction:column}
 .pw-selection-actions{width:100%;justify-content:space-between}
 .pw-timeline article{grid-template-columns:12px 1fr}
 .pw-timeline time{grid-column:2}
 .pw-config-grid{grid-template-columns:minmax(0,1fr);gap:12px}
 .pw-config-column{gap:12px}
 .pw-config-identity{order:1}
 
 .pw-config-proof{order:3}
 .pw-config-downloads{order:4}
 .pw-config-protection{order:5}
 .pw-config-extras{order:6}
 .pw-sales-summary{grid-template-columns:1fr}
 .pw-danger-zone{align-items:stretch;flex-direction:column}
 .pw-danger-zone button{width:100%}
 .pw-cover-grid{grid-template-columns:repeat(3,1fr)}
 .pw-overflow-menu.project{right:0}
}
@media(max-width:430px){
 .pw-status span:nth-last-child(-n+2){display:none}
 .pw-metrics{grid-template-columns:1fr 1fr}
 .pw-card-head img{width:48px;height:48px}
 .pw-share{align-items:stretch;flex-direction:column}
 .pw-share button{width:100%}
 .pw-tabs{gap:14px}
 .pw-folder-actions{align-items:stretch;flex-wrap:wrap}
 .pw-folder-primary{max-width:none}
}
`;
