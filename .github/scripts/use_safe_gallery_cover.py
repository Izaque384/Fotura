from pathlib import Path

p = Path('app/app/dashboard/galerias/page.tsx')
s = p.read_text()
old = ''' async function definirCapa(gid:string,f:FotoModal){const{error}=await supabase.from("galerias").update({capa:f.nome}).eq("id",gid).eq("user_id",uid);if(!error){setGalerias(p=>p.map(g=>g.id===gid?{...g,capa:f.nome,thumbUrl:f.thumb,originalUrl:f.original}:g));setCapaModal(null);setAviso("Capa atualizada.")}}'''
new = ''' async function definirCapa(gid:string,f:FotoModal){if(salvando)return;setSalvando(true);const{data,error}=await supabase.rpc("definir_capa_galeria",{p_galeria:gid,p_arquivo:f.nome});setSalvando(false);if(error||data!==true){setAviso("Não foi possível atualizar a capa.");return}setGalerias(p=>p.map(g=>g.id===gid?{...g,capa:f.nome,thumbUrl:f.thumb,originalUrl:f.original}:g));setCapaModal(null);setAviso("Capa atualizada.")}'''
if old not in s:
    raise SystemExit('cover update anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)
