from pathlib import Path

p = Path('app/app/g/[slug]/page.tsx')
s = p.read_text()

old_state = ''' const[senha,setSenha]=useState("\"),[senhaErro,setSenhaErro]=useState("\"),[validando,setValidando]=useState(false),[limiteMsg,setLimiteMsg]=useState("\"),[baixandoTudo,setBaixandoTudo]=useState(false),[progresso,setProgresso]=useState(0);'''
new_state = ''' const[senha,setSenha]=useState("\"),[senhaErro,setSenhaErro]=useState("\"),[validando,setValidando]=useState(false),[limiteMsg,setLimiteMsg]=useState("\"),[baixandoTudo,setBaixandoTudo]=useState(false),[progresso,setProgresso]=useState(0),[confirmandoFinalizacao,setConfirmandoFinalizacao]=useState(false),[finalizando,setFinalizando]=useState(false);'''
if old_state not in s:
    raise SystemExit('state anchor not found')
s = s.replace(old_state, new_state, 1)

old_fn = ''' async function finalizar(){if(!selecionadas.length||finalizada||encerrada())return;if(!confirm(`Finalizar sua seleção de ${selecionadas.length} foto${selecionadas.length===1?"\"<<":"s"}? Depois não será possível alterar.`))return;const ok=await salvar(selecionadas,true,comentarios);if(ok)setFinalizada(true)}'''
# literal in source is easier to match directly
old_fn = ' async function finalizar(){if(!selecionadas.length||finalizada||encerrada())return;if(!confirm(`Finalizar sua seleção de ${selecionadas.length} foto${selecionadas.length===1?"":"s"}? Depois não será possível alterar.`))return;const ok=await salvar(selecionadas,true,comentarios);if(ok)setFinalizada(true)}'
new_fn = ' async function finalizar(){if(!selecionadas.length||finalizada||encerrada()||finalizando)return;setFinalizando(true);const ok=await salvar(selecionadas,true,comentarios);setFinalizando(false);if(ok){setFinalizada(true);setConfirmandoFinalizacao(false)}}'
if old_fn not in s:
    raise SystemExit('finalize function anchor not found')
s = s.replace(old_fn, new_fn, 1)

old_bar = '{meta.prova&&!bloqueado&&selecionadas.length>0&&<div className="gc-bar"><span>{selecionadas.length}{meta.limite>0?` / ${meta.limite}`:""} selecionada{selecionadas.length===1?"":"s"}</span><button onClick={finalizar}>Finalizar seleção</button></div>}'
new_bar = '{meta.prova&&!bloqueado&&selecionadas.length>0&&<div className="gc-bar"><span>{selecionadas.length}{meta.limite>0?` / ${meta.limite}`:""} selecionada{selecionadas.length===1?"":"s"}</span><button onClick={()=>setConfirmandoFinalizacao(true)}>Finalizar seleção</button></div>}'
if old_bar not in s:
    raise SystemExit('finalize bar anchor not found')
s = s.replace(old_bar, new_bar, 1)

modal = '''{confirmandoFinalizacao&&<div className="gc-confirm" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!finalizando)setConfirmandoFinalizacao(false)}}><div className="gc-confirm-card" role="dialog" aria-modal="true" aria-labelledby="gc-confirm-title"><div className="gc-confirm-icon">✓</div><h2 id="gc-confirm-title">Finalizar seleção?</h2><p>Você está enviando <b>{selecionadas.length} foto{selecionadas.length===1?"":"s"}</b>. Depois de finalizar, não será possível alterar a seleção.</p><div className="gc-confirm-actions"><button className="gc-confirm-cancel" onClick={()=>setConfirmandoFinalizacao(false)} disabled={finalizando}>Voltar</button><button className="gc-confirm-submit" onClick={finalizar} disabled={finalizando}>{finalizando?"Enviando…":"Finalizar seleção"}</button></div></div></div>}'''
anchor = '{finalizada&&<div className="gc-bar done">✓ Seleção enviada — {selecionadas.length} foto{selecionadas.length===1?"":"s"}</div>}'
if anchor not in s:
    raise SystemExit('modal insertion anchor not found')
s = s.replace(anchor, anchor + modal, 1)

css_anchor = '\n.gc-page,.gc-center,.gc-gate{'
css_add = '''\n.gc-confirm{position:fixed;inset:0;z-index:140;background:rgba(3,3,12,.82);display:flex;align-items:center;justify-content:center;padding:20px}.gc-confirm-card{width:min(420px,100%);padding:28px;background:linear-gradient(180deg,#17172f,#101023);border:1px solid #2b2b48;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.45);text-align:center}.gc-confirm-icon{width:46px;height:46px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;background:rgba(143,227,176,.12);color:#8fe3b0;font-size:22px;font-weight:800}.gc-confirm-card h2{margin:0 0 9px;font-size:20px}.gc-confirm-card p{margin:0;color:#9298b2;line-height:1.55;font-size:13px}.gc-confirm-card p b{color:#f0f0f5}.gc-confirm-actions{display:flex;gap:9px;margin-top:22px}.gc-confirm-actions button{flex:1;padding:11px 13px;border-radius:10px;font:700 12px inherit;cursor:pointer}.gc-confirm-actions button:disabled{opacity:.6;cursor:default}.gc-confirm-cancel{border:1px solid #30334b;background:#111124;color:#c7cad8}.gc-confirm-submit{border:0;background:linear-gradient(90deg,#1196fc,#5d0dfa);color:white}'''
if css_anchor not in s:
    raise SystemExit('css anchor not found')
s = s.replace(css_anchor, css_add + css_anchor, 1)

p.write_text(s)
