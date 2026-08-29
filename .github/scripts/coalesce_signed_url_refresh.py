from pathlib import Path

p = Path('app/app/g/[slug]/page.tsx')
s = p.read_text()

old_ref = ' const toqueX=useRef<number|null>(null),downloadAbort=useRef<AbortController|null>(null),cancelarDownload=useRef(false);'
new_ref = ' const toqueX=useRef<number|null>(null),downloadAbort=useRef<AbortController|null>(null),cancelarDownload=useRef(false),ultimaAssinatura=useRef(0),renovacaoEmAndamento=useRef<Promise<Foto[]|null>|null>(null);'
if old_ref not in s:
    raise SystemExit('ref anchor not found')
s = s.replace(old_ref, new_ref, 1)

old_fn = ''' async function renovarAssinaturas(){
  const rf=await fetch(`/api/fotos/signed?galeria=${encodeURIComponent(slug)}`,{cache:"no-store"});
  if(!rf.ok)return null;
  const df=await rf.json() as {fotos:Foto[];capaUrl:string|null};
  setFotos(df.fotos);setCapaUrl(df.capaUrl);
  return df.fotos;
 }'''
new_fn = ''' async function renovarAssinaturas(){
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
if old_fn not in s:
    raise SystemExit('refresh fn anchor not found')
s = s.replace(old_fn, new_fn, 1)

old_effect = ' useEffect(()=>{if(!meta||meta.linkExpirado||!meta.desbloqueada||!fotos.length)return;const id=window.setInterval(()=>{void renovarAssinaturas()},50*60*1000);return()=>window.clearInterval(id)},[slug,meta?.linkExpirado,meta?.desbloqueada,fotos.length]);'
new_effect = ''' useEffect(()=>{if(!meta||meta.linkExpirado||!meta.desbloqueada||!fotos.length)return;const id=window.setInterval(()=>{void renovarAssinaturas()},50*60*1000);return()=>window.clearInterval(id)},[slug,meta?.linkExpirado,meta?.desbloqueada,fotos.length]);
 useEffect(()=>{if(!meta||meta.linkExpirado||!meta.desbloqueada||!fotos.length)return;const atualizarSeAntiga=()=>{if(Date.now()-ultimaAssinatura.current>=45*60*1000)void renovarAssinaturas()};const aoVisivel=()=>{if(document.visibilityState==="visible")atualizarSeAntiga()};document.addEventListener("visibilitychange",aoVisivel);window.addEventListener("online",atualizarSeAntiga);return()=>{document.removeEventListener("visibilitychange",aoVisivel);window.removeEventListener("online",atualizarSeAntiga)}},[slug,meta?.linkExpirado,meta?.desbloqueada,fotos.length]);'''
if old_effect not in s:
    raise SystemExit('interval effect anchor not found')
s = s.replace(old_effect, new_effect, 1)

p.write_text(s)
