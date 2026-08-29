from pathlib import Path

p = Path('app/app/g/[slug]/page.tsx')
s = p.read_text()

old_ref = ' const toqueX=useRef<number|null>(null),downloadAbort=useRef<AbortController|null>(null),cancelarDownload=useRef(false),ultimaAssinatura=useRef(0),renovacaoEmAndamento=useRef<Promise<Foto[]|null>|null>(null),filaSalvamento=useRef<Promise<void>>(Promise.resolve()),selecaoAtual=useRef<string[]>([]),comentariosAtuais=useRef<Record<string,string>>({});'
new_ref = ' const toqueX=useRef<number|null>(null),downloadAbort=useRef<AbortController|null>(null),cancelarDownload=useRef(false),ultimaAssinatura=useRef(0),renovacaoEmAndamento=useRef<Promise<Foto[]|null>|null>(null),estadoEmAndamento=useRef<Promise<void>|null>(null),filaSalvamento=useRef<Promise<void>>(Promise.resolve()),selecaoAtual=useRef<string[]>([]),comentariosAtuais=useRef<Record<string,string>>({}),salvamentoPendente=useRef<{fotos:string[];comentarios:Record<string,string>}|null>(null),imagensFalharam=useRef<Set<string>>(new Set());'
if old_ref not in s: raise SystemExit('ref anchor not found')
s = s.replace(old_ref, new_ref, 1)

old_refresh = ''' async function renovarAssinaturas(){
  if(renovacaoEmAndamento.current)return renovacaoEmAndamento.current;
  const tarefa=(async()=>{
   const rf=await fetch(`/api/fotos/signed?galeria=${encodeURIComponent(slug)}`,{cache:"no-store"});
   if(!rf.ok)return null;
   const df=await rf.json() as {fotos:Foto[];capaUrl:string|null};
   setFotos(df.fotos);setCapaUrl(df.capaUrl);ultimaAssinatura.current=Date.now();
   return df.fotos;
  })();
  renovacaoEmAndamento.current=tarefa;
  try{return await tarefa}finally{renovacaoEmAndamento.current=null}
 }'''
new_refresh = ''' async function renovarAssinaturas(){
  if(renovacaoEmAndamento.current)return renovacaoEmAndamento.current;
  const tarefa=(async()=>{
   const rf=await fetch(`/api/fotos/signed?galeria=${encodeURIComponent(slug)}`,{cache:"no-store"});
   if(rf.status===401){setMeta(m=>m?{...m,desbloqueada:false}:m);setFotos([]);setCapaUrl(null);setMensagem("Sua sessão de acesso expirou. Digite a senha novamente.");return null}
   if(rf.status===403){setMeta(m=>m?{...m,linkExpirado:true}:m);setFotos([]);setCapaUrl(null);return null}
   if(rf.status===404){setNaoAchou(true);setFotos([]);setCapaUrl(null);return null}
   if(!rf.ok)return null;
   const df=await rf.json() as {fotos:Foto[];capaUrl:string|null};
   setFotos(df.fotos);setCapaUrl(df.capaUrl);ultimaAssinatura.current=Date.now();imagensFalharam.current.clear();
   return df.fotos;
  })();
  renovacaoEmAndamento.current=tarefa;
  try{return await tarefa}finally{renovacaoEmAndamento.current=null}
 }
 async function revalidarEstado(){
  if(estadoEmAndamento.current)return estadoEmAndamento.current;
  const tarefa=(async()=>{try{
   const r=await fetch(`/api/galeria/publica?galeria=${encodeURIComponent(slug)}`,{cache:"no-store"});
   if(r.status===404){setNaoAchou(true);setFotos([]);setCapaUrl(null);return}
   if(!r.ok)return;
   const d=await r.json() as {galeria:Meta;perfil:Perfil;selecao:Selecao|null};
   setMeta(d.galeria);setPerfil(d.perfil);
   if(d.galeria.linkExpirado){setFotos([]);setCapaUrl(null);return}
   if(d.galeria.temSenha&&!d.galeria.desbloqueada){setFotos([]);setCapaUrl(null);setMensagem("Sua sessão de acesso expirou. Digite a senha novamente.");return}
   if(d.selecao?.finalizada){selecaoAtual.current=d.selecao.fotos;comentariosAtuais.current=d.selecao.comentarios;setSelecionadas(d.selecao.fotos);setComentarios(d.selecao.comentarios);setFinalizada(true);salvamentoPendente.current=null}
  }catch{}})();
  estadoEmAndamento.current=tarefa;try{await tarefa}finally{estadoEmAndamento.current=null}
 }
 async function repetirSalvamentoPendente(){const pendente=salvamentoPendente.current;if(!pendente||finalizada)return;await salvar(pendente.fotos,false,pendente.comentarios)}'''
if old_refresh not in s: raise SystemExit('refresh anchor not found')
s = s.replace(old_refresh, new_refresh, 1)

old_effects = ''' useEffect(()=>{if(!meta||meta.linkExpirado||!meta.desbloqueada||!fotos.length)return;const id=window.setInterval(()=>{void renovarAssinaturas()},50*60*1000);return()=>window.clearInterval(id)},[slug,meta?.linkExpirado,meta?.desbloqueada,fotos.length]);
 useEffect(()=>{if(!meta||meta.linkExpirado||!meta.desbloqueada||!fotos.length)return;const atualizarSeAntiga=()=>{if(Date.now()-ultimaAssinatura.current>=45*60*1000)void renovarAssinaturas()};const aoVisivel=()=>{if(document.visibilityState==="visible")atualizarSeAntiga()};document.addEventListener("visibilitychange",aoVisivel);window.addEventListener("online",atualizarSeAntiga);return()=>{document.removeEventListener("visibilitychange",aoVisivel);window.removeEventListener("online",atualizarSeAntiga)}},[slug,meta?.linkExpirado,meta?.desbloqueada,fotos.length]);'''
new_effects = ''' useEffect(()=>{if(!meta||meta.linkExpirado||!meta.desbloqueada||!fotos.length)return;const id=window.setInterval(()=>{void renovarAssinaturas()},50*60*1000);return()=>window.clearInterval(id)},[slug,meta?.linkExpirado,meta?.desbloqueada,fotos.length]);
 useEffect(()=>{if(!meta)return;const id=window.setInterval(()=>{void revalidarEstado()},5*60*1000);return()=>window.clearInterval(id)},[slug,Boolean(meta)]);
 useEffect(()=>{if(!meta)return;const atualizar=()=>{void revalidarEstado();if(!meta.linkExpirado&&meta.desbloqueada&&fotos.length&&Date.now()-ultimaAssinatura.current>=45*60*1000)void renovarAssinaturas()};const aoVisivel=()=>{if(document.visibilityState==="visible")atualizar()};const aoOnline=()=>{atualizar();void repetirSalvamentoPendente()};document.addEventListener("visibilitychange",aoVisivel);window.addEventListener("online",aoOnline);return()=>{document.removeEventListener("visibilitychange",aoVisivel);window.removeEventListener("online",aoOnline)}},[slug,meta?.linkExpirado,meta?.desbloqueada,fotos.length,finalizada]);'''
if old_effects not in s: raise SystemExit('effects anchor not found')
s = s.replace(old_effects, new_effects, 1)

old_save = ''' async function salvar(nomes:string[],fin:boolean,coments:Record<string,string>){
  const executar=async()=>{try{const r=await fetch("/api/galeria/selecao",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({galeria:slug,fotos:nomes,finalizada:fin,comentarios:coments})});if(!r.ok){const d=await r.json().catch(()=>({error:"Não foi possível salvar."}));setMensagem(d.error||"Não foi possível salvar a seleção.");return false}return true}catch{setMensagem("Não foi possível salvar a seleção. Verifique sua conexão e tente novamente.");return false}};
  let resultado=false;const anterior=filaSalvamento.current;const atual=anterior.then(async()=>{resultado=await executar()});filaSalvamento.current=atual.catch(()=>undefined);await atual;return resultado
 }'''
new_save = ''' async function salvar(nomes:string[],fin:boolean,coments:Record<string,string>){
  const executar=async()=>{for(let tentativa=0;tentativa<2;tentativa++){try{const r=await fetch("/api/galeria/selecao",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({galeria:slug,fotos:nomes,finalizada:fin,comentarios:coments})});if(r.ok){if(!fin)salvamentoPendente.current=null;return true}const d=await r.json().catch(()=>({error:"Não foi possível salvar."}));if(r.status>=500&&tentativa===0){await new Promise(res=>setTimeout(res,800));continue}if(r.status===401){setMeta(m=>m?{...m,desbloqueada:false}:m);setFotos([]);setCapaUrl(null)}if(r.status===403&&d.error==="Link expirado."){setMeta(m=>m?{...m,linkExpirado:true}:m);setFotos([]);setCapaUrl(null)}setMensagem(d.error||"Não foi possível salvar a seleção.");if(!fin)salvamentoPendente.current={fotos:nomes,comentarios:coments};return false}catch{if(tentativa===0){await new Promise(res=>setTimeout(res,800));continue}setMensagem("Não foi possível salvar a seleção. As alterações serão tentadas novamente quando a conexão voltar.");if(!fin)salvamentoPendente.current={fotos:nomes,comentarios:coments};return false}}return false};
  let resultado=false;const anterior=filaSalvamento.current;const atual=anterior.then(async()=>{resultado=await executar()});filaSalvamento.current=atual.catch(()=>undefined);await atual;return resultado
 }'''
if old_save not in s: raise SystemExit('save anchor not found')
s = s.replace(old_save, new_save, 1)

old_nav = ' function proxima(){setAberta(v=>v===null?null:(v+1)%fotos.length)}function anterior(){setAberta(v=>v===null?null:(v-1+fotos.length)%fotos.length)}\n async function baixar(url:string,nome:string,signal?:AbortSignal)'
new_nav = ' function proxima(){setAberta(v=>v===null?null:(v+1)%fotos.length)}function anterior(){setAberta(v=>v===null?null:(v-1+fotos.length)%fotos.length)}\n function imagemFalhou(e:React.SyntheticEvent<HTMLImageElement>,foto:Foto){const img=e.currentTarget;if(img.src!==foto.url){img.src=foto.url;return}if(imagensFalharam.current.has(foto.nome))return;imagensFalharam.current.add(foto.nome);void renovarAssinaturas()}\n async function baixar(url:string,nome:string,signal?:AbortSignal)'
if old_nav not in s: raise SystemExit('image handler anchor not found')
s = s.replace(old_nav, new_nav, 1)

old_grid_img = '<img src={f.thumb||f.url} onError={e=>{if(e.currentTarget.src!==f.url)e.currentTarget.src=f.url}} onClick={()=>setAberta(i)} loading="lazy" alt="Foto"/>'
new_grid_img = '<img src={f.thumb||f.url} onError={e=>imagemFalhou(e,f)} onClick={()=>setAberta(i)} loading="lazy" alt="Foto"/>'
if old_grid_img not in s: raise SystemExit('grid image anchor not found')
s = s.replace(old_grid_img, new_grid_img, 1)

old_lightbox_img = '<img src={fotos[aberta].url} alt="Foto ampliada" onTouchStart='
new_lightbox_img = '<img src={fotos[aberta].url} alt="Foto ampliada" onError={e=>imagemFalhou(e,fotos[aberta])} onTouchStart='
if old_lightbox_img not in s: raise SystemExit('lightbox image anchor not found')
s = s.replace(old_lightbox_img, new_lightbox_img, 1)

p.write_text(s)
