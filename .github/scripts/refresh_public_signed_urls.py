from pathlib import Path

p = Path('app/app/g/[slug]/page.tsx')
s = p.read_text()

old_load = '''  if(!d.galeria.linkExpirado&&d.galeria.desbloqueada){
   const rf=await fetch(`/api/fotos/signed?galeria=${encodeURIComponent(slug)}`,{cache:"no-store"});
   if(rf.ok){const df=await rf.json() as {fotos:Foto[];capaUrl:string|null};setFotos(df.fotos);setCapaUrl(df.capaUrl)}
   else if(rf.status!==401)setMensagem("Não foi possível carregar as fotos.");
  } else {setFotos([]);setCapaUrl(null)}
  setCarregando(false);
 }
 useEffect(()=>{carregar()},[slug]);'''
new_load = '''  if(!d.galeria.linkExpirado&&d.galeria.desbloqueada){
   const df=await renovarAssinaturas();
   if(!df)setMensagem("Não foi possível carregar as fotos.");
  } else {setFotos([]);setCapaUrl(null)}
  setCarregando(false);
 }
 async function renovarAssinaturas(){
  const rf=await fetch(`/api/fotos/signed?galeria=${encodeURIComponent(slug)}`,{cache:"no-store"});
  if(!rf.ok)return null;
  const df=await rf.json() as {fotos:Foto[];capaUrl:string|null};
  setFotos(df.fotos);setCapaUrl(df.capaUrl);
  return df.fotos;
 }
 useEffect(()=>{carregar()},[slug]);'''
if old_load not in s:
    raise SystemExit('load anchor not found')
s = s.replace(old_load, new_load, 1)

old_effects = ''' useEffect(()=>{if(aberta===null)return;const f=fotos[aberta];setRascunho(f?(comentarios[f.nome]??""):"")},[aberta,fotos,comentarios]);
 useEffect(()=>{if(aberta===null)return;const key=(e:KeyboardEvent)=>{const a=e.target as HTMLElement|null;if(a&&(a.tagName==="TEXTAREA"||a.tagName==="INPUT"))return;if(e.key==="Escape")setAberta(null);if(e.key==="ArrowRight")proxima();if(e.key==="ArrowLeft")anterior()};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[aberta,fotos.length]);'''
new_effects = ''' useEffect(()=>{if(aberta===null)return;const f=fotos[aberta];setRascunho(f?(comentarios[f.nome]??""):"")},[aberta,fotos,comentarios]);
 useEffect(()=>{if(aberta===null)return;const key=(e:KeyboardEvent)=>{const a=e.target as HTMLElement|null;if(a&&(a.tagName==="TEXTAREA"||a.tagName==="INPUT"))return;if(e.key==="Escape")setAberta(null);if(e.key==="ArrowRight")proxima();if(e.key==="ArrowLeft")anterior()};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[aberta,fotos.length]);
 useEffect(()=>{if(!meta||meta.linkExpirado||!meta.desbloqueada||!fotos.length)return;const id=window.setInterval(()=>{void renovarAssinaturas()},50*60*1000);return()=>window.clearInterval(id)},[slug,meta?.linkExpirado,meta?.desbloqueada,fotos.length]);'''
if old_effects not in s:
    raise SystemExit('effects anchor not found')
s = s.replace(old_effects, new_effects, 1)

old_download = ''' async function baixar(url:string,nome:string,signal?:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw new Error();const b=await r.blob();if(signal?.aborted)throw new DOMException("Abortado","AbortError");const href=URL.createObjectURL(b),a=document.createElement("a");a.href=href;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),4000)}
 function interromperDownloads(){if(!baixandoTudo)return;cancelarDownload.current=true;downloadAbort.current?.abort()}
 async function baixarTodas(){if(baixandoTudo||!fotos.length)return;setMensagem("");setBaixandoTudo(true);setProgresso(0);cancelarDownload.current=false;let falhas=0;for(let i=0;i<fotos.length;i++){if(cancelarDownload.current)break;const controller=new AbortController();downloadAbort.current=controller;try{await baixar(fotos[i].url,fotos[i].nome,controller.signal)}catch(e){if(cancelarDownload.current||(e instanceof DOMException&&e.name==="AbortError"))break;falhas++}setProgresso(i+1);if(i<fotos.length-1&&!cancelarDownload.current)await new Promise(r=>setTimeout(r,320))}downloadAbort.current=null;const cancelado=cancelarDownload.current;setBaixandoTudo(false);setProgresso(0);cancelarDownload.current=false;if(cancelado)setMensagem("Download interrompido. Os arquivos já baixados foram mantidos.");else if(falhas>0)setMensagem(`${falhas} arquivo${falhas===1?"":"s"} não ${falhas===1?"pôde":"puderam"} ser baixado${falhas===1?"":"s"}. Tente novamente.`)}'''
new_download = ''' async function baixar(url:string,nome:string,signal?:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw new Error();const b=await r.blob();if(signal?.aborted)throw new DOMException("Abortado","AbortError");const href=URL.createObjectURL(b),a=document.createElement("a");a.href=href;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),4000)}
 async function baixarComRenovacao(url:string,nome:string,signal?:AbortSignal){try{await baixar(url,nome,signal);return}catch(e){if(signal?.aborted||(e instanceof DOMException&&e.name==="AbortError"))throw e}const novas=await renovarAssinaturas();const atualizada=novas?.find(f=>f.nome===nome);if(!atualizada)throw new Error();await baixar(atualizada.url,nome,signal)}
 function interromperDownloads(){if(!baixandoTudo)return;cancelarDownload.current=true;downloadAbort.current?.abort()}
 async function baixarTodas(){if(baixandoTudo||!fotos.length)return;setMensagem("");setBaixandoTudo(true);setProgresso(0);cancelarDownload.current=false;let falhas=0;for(let i=0;i<fotos.length;i++){if(cancelarDownload.current)break;const controller=new AbortController();downloadAbort.current=controller;try{await baixarComRenovacao(fotos[i].url,fotos[i].nome,controller.signal)}catch(e){if(cancelarDownload.current||(e instanceof DOMException&&e.name==="AbortError"))break;falhas++}setProgresso(i+1);if(i<fotos.length-1&&!cancelarDownload.current)await new Promise(r=>setTimeout(r,320))}downloadAbort.current=null;const cancelado=cancelarDownload.current;setBaixandoTudo(false);setProgresso(0);cancelarDownload.current=false;if(cancelado)setMensagem("Download interrompido. Os arquivos já baixados foram mantidos.");else if(falhas>0)setMensagem(`${falhas} arquivo${falhas===1?"":"s"} não ${falhas===1?"pôde":"puderam"} ser baixado${falhas===1?"":"s"}. Tente novamente.`)}'''
if old_download not in s:
    raise SystemExit('download anchor not found')
s = s.replace(old_download, new_download, 1)

s = s.replace('onClick={()=>baixar(f.url,f.nome)} aria-label={`Baixar ${f.nome}`}', 'onClick={()=>baixarComRenovacao(f.url,f.nome)} aria-label={`Baixar ${f.nome}`}', 1)
s = s.replace('e.stopPropagation();baixar(fotos[aberta].url,fotos[aberta].nome)', 'e.stopPropagation();baixarComRenovacao(fotos[aberta].url,fotos[aberta].nome)', 1)

p.write_text(s)
