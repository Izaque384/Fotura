from pathlib import Path

p = Path('app/app/dashboard/galerias/page.tsx')
s = p.read_text()
old = ''' async function removerSenha(){if(!configModal)return;await supabase.from("senhas").delete().eq("galeria",configModal);const{error}=await supabase.from("galerias").update({tem_senha:false}).eq("id",configModal).eq("user_id",uid);if(!error){setGalerias(p=>p.map(g=>g.id===configModal?{...g,config:{...g.config,temSenha:false}}:g));setFSenha("");setAviso("Senha removida.")}}'''
new = ''' async function removerSenha(){if(!configModal||salvando)return;setSalvando(true);const{data,error}=await supabase.rpc("remover_senha_galeria",{p_galeria:configModal});setSalvando(false);if(error||data!==true){setAviso("Não foi possível remover a senha.");return}setGalerias(p=>p.map(g=>g.id===configModal?{...g,config:{...g.config,temSenha:false}}:g));setFSenha("");setAviso("Senha removida.")}'''
if old not in s:
    raise SystemExit('password removal anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)
