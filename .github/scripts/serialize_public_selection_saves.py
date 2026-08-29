from pathlib import Path

p = Path('app/app/g/[slug]/page.tsx')
s = p.read_text()

old_ref = ' const toqueX=useRef<number|null>(null),downloadAbort=useRef<AbortController|null>(null),cancelarDownload=useRef(false),ultimaAssinatura=useRef(0),renovacaoEmAndamento=useRef<Promise<Foto[]|null>|null>(null);'
new_ref = ' const toqueX=useRef<number|null>(null),downloadAbort=useRef<AbortController|null>(null),cancelarDownload=useRef(false),ultimaAssinatura=useRef(0),renovacaoEmAndamento=useRef<Promise<Foto[]|null>|null>(null),filaSalvamento=useRef<Promise<void>>(Promise.resolve()),selecaoAtual=useRef<string[]>([]),comentariosAtuais=useRef<Record<string,string>>({});'
if old_ref not in s:
    raise SystemExit('ref anchor not found')
s = s.replace(old_ref, new_ref, 1)

old_load = '  if(d.selecao){setSelecionadas(d.selecao.fotos);setFinalizada(d.selecao.finalizada);setComentarios(d.selecao.comentarios)}\n  else {setSelecionadas([]);setFinalizada(false);setComentarios({})}'
new_load = '  if(d.selecao){selecaoAtual.current=d.selecao.fotos;comentariosAtuais.current=d.selecao.comentarios;setSelecionadas(d.selecao.fotos);setFinalizada(d.selecao.finalizada);setComentarios(d.selecao.comentarios)}\n  else {selecaoAtual.current=[];comentariosAtuais.current={};setSelecionadas([]);setFinalizada(false);setComentarios({})}'
if old_load not in s:
    raise SystemExit('load selection anchor not found')
s = s.replace(old_load, new_load, 1)

old_save = ' async function salvar(nomes:string[],fin:boolean,coments:Record<string,string>){const r=await fetch("/api/galeria/selecao",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({galeria:slug,fotos:nomes,finalizada:fin,comentarios:coments})});if(!r.ok){const d=await r.json().catch(()=>({error:"Não foi possível salvar."}));setMensagem(d.error||"Não foi possível salvar a seleção.");return false}return true}'
new_save = ''' async function salvar(nomes:string[],fin:boolean,coments:Record<string,string>){
  const executar=async()=>{try{const r=await fetch("/api/galeria/selecao",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({galeria:slug,fotos:nomes,finalizada:fin,comentarios:coments})});if(!r.ok){const d=await r.json().catch(()=>({error:"Não foi possível salvar."}));setMensagem(d.error||"Não foi possível salvar a seleção.");return false}return true}catch{setMensagem("Não foi possível salvar a seleção. Verifique sua conexão e tente novamente.");return false}};
  let resultado=false;const anterior=filaSalvamento.current;const atual=anterior.then(async()=>{resultado=await executar()});filaSalvamento.current=atual.catch(()=>undefined);await atual;return resultado
 }'''
if old_save not in s:
    raise SystemExit('save anchor not found')
s = s.replace(old_save, new_save, 1)

old_toggle = ' async function alternar(nome:string){if(!meta||finalizada||encerrada())return;const tem=selecionadas.includes(nome);if(!tem&&meta.limite>0&&selecionadas.length>=meta.limite){setLimiteMsg(`Você já escolheu o máximo de ${meta.limite} foto${meta.limite===1?"":"s"}.`);setTimeout(()=>setLimiteMsg(""),2600);return}const n=tem?selecionadas.filter(x=>x!==nome):[...selecionadas,nome];setSelecionadas(n);if(!await salvar(n,false,comentarios))setSelecionadas(selecionadas)}'
new_toggle = ' async function alternar(nome:string){if(!meta||finalizada||encerrada())return;const atual=selecaoAtual.current,tem=atual.includes(nome);if(!tem&&meta.limite>0&&atual.length>=meta.limite){setLimiteMsg(`Você já escolheu o máximo de ${meta.limite} foto${meta.limite===1?"":"s"}.`);setTimeout(()=>setLimiteMsg(""),2600);return}const n=tem?atual.filter(x=>x!==nome):[...atual,nome];selecaoAtual.current=n;setSelecionadas(n);await salvar(n,false,comentariosAtuais.current)}'
if old_toggle not in s:
    raise SystemExit('toggle anchor not found')
s = s.replace(old_toggle, new_toggle, 1)

old_finalize = ' async function finalizar(){if(!selecionadas.length||finalizada||encerrada()||finalizando)return;setFinalizando(true);const ok=await salvar(selecionadas,true,comentarios);setFinalizando(false);if(ok){setFinalizada(true);setConfirmandoFinalizacao(false)}}'
new_finalize = ' async function finalizar(){if(!selecaoAtual.current.length||finalizada||encerrada()||finalizando)return;setFinalizando(true);const ok=await salvar(selecaoAtual.current,true,comentariosAtuais.current);setFinalizando(false);if(ok){setFinalizada(true);setConfirmandoFinalizacao(false)}}'
if old_finalize not in s:
    raise SystemExit('finalize anchor not found')
s = s.replace(old_finalize, new_finalize, 1)

old_comment = ' async function comentar(){if(aberta===null)return;const nome=fotos[aberta].nome,n={...comentarios,[nome]:rascunho.trim()};setComentarios(n);if(!await salvar(selecionadas,false,n))setComentarios(comentarios);else setAberta(null)}'
new_comment = ' async function comentar(){if(aberta===null)return;const nome=fotos[aberta].nome,n={...comentariosAtuais.current,[nome]:rascunho.trim()};comentariosAtuais.current=n;setComentarios(n);if(await salvar(selecaoAtual.current,false,n))setAberta(null)}'
if old_comment not in s:
    raise SystemExit('comment anchor not found')
s = s.replace(old_comment, new_comment, 1)

p.write_text(s)
