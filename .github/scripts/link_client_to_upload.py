from pathlib import Path

# Clients: add New gallery action for each client.
p = Path('app/app/dashboard/clientes/page.tsx')
s = p.read_text()
old = '<div className="actions"><button className="btn ghost" type="button" onClick={()=>editar(c)}>Editar</button><button className="btn ghost danger" type="button" onClick={()=>setExcluirCliente(c)}>Excluir</button></div></article>'
new = '<div className="actions"><button className="btn" type="button" onClick={()=>router.push(`/upload?cliente=${encodeURIComponent(c.id)}`)}>+ Nova galeria</button><button className="btn ghost" type="button" onClick={()=>editar(c)}>Editar</button><button className="btn ghost danger" type="button" onClick={()=>setExcluirCliente(c)}>Excluir</button></div></article>'
if old not in s:
    raise SystemExit('clients anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)

# Upload: honor client query param only for new galleries and only if it belongs to the signed-in user.
p = Path('app/app/upload/page.tsx')
s = p.read_text()
old = ' const galeriaFixa=searchParams.get("galeria"),nomeTravado=Boolean(galeriaFixa);'
new = ' const galeriaFixa=searchParams.get("galeria"),clienteInicial=searchParams.get("cliente"),nomeTravado=Boolean(galeriaFixa);'
if old not in s:
    raise SystemExit('upload query anchor not found')
s = s.replace(old, new, 1)
old = 'const{data:cs}=await supabase.from("clientes").select("id,nome,email,telefone").eq("user_id",uid).order("nome");if(ativo)setClientes((cs??[]) as Cliente[]);if(galeriaFixa)'
new = 'const{data:cs}=await supabase.from("clientes").select("id,nome,email,telefone").eq("user_id",uid).order("nome");const listaClientes=(cs??[]) as Cliente[];if(ativo){setClientes(listaClientes);if(!galeriaFixa&&clienteInicial&&listaClientes.some(c=>c.id===clienteInicial))setClienteId(clienteInicial)}if(galeriaFixa)'
if old not in s:
    raise SystemExit('upload client load anchor not found')
s = s.replace(old, new, 1)
old = '})();return()=>{ativo=false}},[router,supabase,galeriaFixa]);'
new = '})();return()=>{ativo=false}},[router,supabase,galeriaFixa,clienteInicial]);'
if old not in s:
    raise SystemExit('upload effect deps anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)
