from pathlib import Path

p = Path('app/app/upload/page.tsx')
s = p.read_text()
old = '  const lista=[...arquivos];setEnviando(true);setProcessadas(0);setTotalEnvio(lista.length);setProgresso(0);progressoBytes.current.clear();totalBytes.current=lista.reduce((acc,a)=>acc+a.size,0);'
new = '  const{error:reativarErro}=await supabase.from("galerias").update({storage_limpo:false,storage_limpo_em:null}).eq("id",galeriaId).eq("user_id",uid);if(reativarErro){setErro(true);setMensagem("Não foi possível preparar a galeria para receber novas fotos.");return}\n  const lista=[...arquivos];setEnviando(true);setProcessadas(0);setTotalEnvio(lista.length);setProgresso(0);progressoBytes.current.clear();totalBytes.current=lista.reduce((acc,a)=>acc+a.size,0);'
if old not in s:
    raise SystemExit('upload anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)
