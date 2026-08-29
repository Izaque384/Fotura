from pathlib import Path

p = Path('app/app/g/[slug]/page.tsx')
s = p.read_text()

anchor = '''function contraste(hex:string){const c=(hex||"").replace("#","");if(c.length!==6)return"#fff";const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);return(.299*r+.587*g+.114*b)/255>.6?"#111218":"#fff"}\n'''
insert = anchor + '''\nfunction DownloadIcon({size=18}:{size?:number}){return <svg className="gc-download-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>}\n'''
if anchor not in s:
    raise SystemExit('icon anchor not found')
s = s.replace(anchor, insert, 1)

old_state = ''' const[senha,setSenha]=useState(""),[senhaErro,setSenhaErro]=useState(""),[validando,setValidando]=useState(false),[limiteMsg,setLimiteMsg]=useState(""),[baixandoTudo,setBaixandoTudo]=useState(false),[progresso,setProgresso]=useState(0),[confirmandoFinalizacao,setConfirmandoFinalizacao]=useState(false),[finalizando,setFinalizando]=useState(false);\n const toqueX=useRef<number|null>(null);'''
new_state = ''' const[senha,setSenha]=useState(""),[senhaErro,setSenhaErro]=useState(""),[validando,setValidando]=useState(false),[limiteMsg,setLimiteMsg]=useState(""),[baixandoTudo,setBaixandoTudo]=useState(false),[progresso,setProgresso]=useState(0),[confirmandoFinalizacao,setConfirmandoFinalizacao]=useState(false),[finalizando,setFinalizando]=useState(false);\n const toqueX=useRef<number|null>(null),downloadAbort=useRef<AbortController|null>(null),cancelarDownload=useRef(false);'''
if old_state not in s:
    raise SystemExit('state anchor not found')
s = s.replace(old_state, new_state, 1)

old_download = ''' async function baixar(url:string,nome:string){const r=await fetch(url);if(!r.ok)throw new Error();const b=await r.blob(),href=URL.createObjectURL(b),a=document.createElement("a");a.href=href;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),4000)}\n async function baixarTodas(){if(baixandoTudo)return;setBaixandoTudo(true);for(let i=0;i<fotos.length;i++){try{await baixar(fotos[i].url,fotos[i].nome)}catch{}setProgresso(i+1);await new Promise(r=>setTimeout(r,350))}setBaixandoTudo(false);setProgresso(0)}'''
new_download = ''' async function baixar(url:string,nome:string,signal?:AbortSignal){const r=await fetch(url,{signal});if(!r.ok)throw new Error();const b=await r.blob();if(signal?.aborted)throw new DOMException("Abortado","AbortError");const href=URL.createObjectURL(b),a=document.createElement("a");a.href=href;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),4000)}\n function interromperDownloads(){if(!baixandoTudo)return;cancelarDownload.current=true;downloadAbort.current?.abort()}\n async function baixarTodas(){if(baixandoTudo||!fotos.length)return;setMensagem("");setBaixandoTudo(true);setProgresso(0);cancelarDownload.current=false;let falhas=0;for(let i=0;i<fotos.length;i++){if(cancelarDownload.current)break;const controller=new AbortController();downloadAbort.current=controller;try{await baixar(fotos[i].url,fotos[i].nome,controller.signal)}catch(e){if(cancelarDownload.current||(e instanceof DOMException&&e.name==="AbortError"))break;falhas++}setProgresso(i+1);if(i<fotos.length-1&&!cancelarDownload.current)await new Promise(r=>setTimeout(r,320))}downloadAbort.current=null;const cancelado=cancelarDownload.current;setBaixandoTudo(false);setProgresso(0);cancelarDownload.current=false;if(cancelado)setMensagem("Download interrompido. Os arquivos já baixados foram mantidos.");else if(falhas>0)setMensagem(`${falhas} arquivo${falhas===1?"":"s"} não ${falhas===1?"pôde":"puderam"} ser baixado${falhas===1?"":"s"}. Tente novamente.`)}'''
if old_download not in s:
    raise SystemExit('download functions anchor not found')
s = s.replace(old_download, new_download, 1)

old_all = '''{!meta.prova&&<button className="gc-secondary" onClick={baixarTodas} disabled={baixandoTudo}>{baixandoTudo?`Baixando ${progresso}/${fotos.length}`:"Baixar todas"}</button>}'''
new_all = '''{!meta.prova&&<div className="gc-download-all">{baixandoTudo?<><span className="gc-download-progress">Baixando {progresso}/{fotos.length}</span><button className="gc-secondary gc-cancel-download" onClick={interromperDownloads}>Cancelar</button></>:<button className="gc-secondary" onClick={baixarTodas}><DownloadIcon size={17}/>Baixar todas</button>}</div>}'''
if old_all not in s:
    raise SystemExit('download all anchor not found')
s = s.replace(old_all, new_all, 1)

old_individual = '''{!meta.prova&&<button className="gc-download" onClick={()=>baixar(f.url,f.nome)} aria-label="Baixar foto">↓</button>}'''
new_individual = '''{!meta.prova&&<button className="gc-download" onClick={()=>baixar(f.url,f.nome)} aria-label={`Baixar ${f.nome}`} title="Baixar foto"><DownloadIcon size={20}/></button>}'''
if old_individual not in s:
    raise SystemExit('individual download anchor not found')
s = s.replace(old_individual, new_individual, 1)

css_anchor = '''\n.gc-confirm{position:fixed;'''
css_add = '''\n.gc-download-icon{display:block;flex:0 0 auto}.gc-secondary{display:inline-flex;align-items:center;justify-content:center;gap:7px}.gc-download-all{display:flex;align-items:center;gap:9px}.gc-download-progress{font-size:12px;color:#8f96b0;white-space:nowrap}.gc-cancel-download{border-color:#48303a!important;color:#ffb2b2!important;background:#1b1219!important}.gc-download{display:grid!important;place-items:center!important}.gc-download .gc-download-icon{transition:transform .16s ease}.gc-download:hover .gc-download-icon{transform:translateY(1px)}\n'''
if css_anchor not in s:
    raise SystemExit('css anchor not found')
s = s.replace(css_anchor, css_add + css_anchor, 1)

p.write_text(s)
