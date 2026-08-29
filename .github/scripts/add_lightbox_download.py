from pathlib import Path

p = Path('app/app/g/[slug]/page.tsx')
s = p.read_text()

old_css = '.gc-download .gc-download-icon{transition:transform .16s ease}.gc-download:hover .gc-download-icon{transform:translateY(1px)}'
new_css = '.gc-download .gc-download-icon{display:block}'
if old_css not in s:
    raise SystemExit('download hover css anchor not found')
s = s.replace(old_css, new_css, 1)

old_lightbox = '{aberta!==null&&fotos[aberta]&&<div className="gc-lightbox" onClick={()=>setAberta(null)}><button className="gc-close" onClick={()=>setAberta(null)}>×</button>{fotos.length>1&&<button className="gc-nav prev" onClick={e=>{e.stopPropagation();anterior()}}>‹</button>}'
new_lightbox = '{aberta!==null&&fotos[aberta]&&<div className="gc-lightbox" onClick={()=>setAberta(null)}><button className="gc-close" onClick={()=>setAberta(null)}>×</button>{!meta.prova&&<button className="gc-lightbox-download" onClick={e=>{e.stopPropagation();baixar(fotos[aberta].url,fotos[aberta].nome)}} aria-label={`Baixar ${fotos[aberta].nome}`} title="Baixar foto"><DownloadIcon size={20}/></button>}{fotos.length>1&&<button className="gc-nav prev" onClick={e=>{e.stopPropagation();anterior()}}>‹</button>}'
if old_lightbox not in s:
    raise SystemExit('lightbox anchor not found')
s = s.replace(old_lightbox, new_lightbox, 1)

old_close_css = '.gc-close,.gc-nav{position:absolute;z-index:3;border:1px solid rgba(255,255,255,.2);background:rgba(20,20,36,.7);color:#fff;cursor:pointer}.gc-close{top:20px;right:20px;width:44px;height:44px;border-radius:12px;font-size:25px}'
new_close_css = '.gc-close,.gc-nav,.gc-lightbox-download{position:absolute;z-index:3;border:1px solid rgba(255,255,255,.2);background:rgba(20,20,36,.7);color:#fff;cursor:pointer}.gc-close{top:20px;right:20px;width:44px;height:44px;border-radius:12px;font-size:25px}.gc-lightbox-download{top:20px;right:74px;width:44px;height:44px;border-radius:12px;display:grid;place-items:center}'
if old_close_css not in s:
    raise SystemExit('lightbox css anchor not found')
s = s.replace(old_close_css, new_close_css, 1)

p.write_text(s)
