from pathlib import Path

# Galerias: remove Storage N+1 from initial page load.
p = Path('app/app/dashboard/galerias/page.tsx')
s = p.read_text()

anchor = ' async function listarArquivosGaleria(gid:string,userId=uid){const nomes:string[]=[];let offset=0;while(true){const{data,error}=await supabase.storage.from("fotos").list(`${userId}/${gid}`,{limit:1000,offset,sortBy:{column:"created_at",order:"asc"}});if(error)throw error;const pagina=(data??[]).filter(f=>f.id!==null);nomes.push(...pagina.map(f=>f.name));if((data??[]).length<1000)break;offset+=1000}return nomes}\n'
if anchor not in s:
    raise SystemExit('gallery list anchor not found')
helper = anchor + ' async function assinarCaminhos(caminhos:string[]){const mapa=new Map<string,string>();for(let i=0;i<caminhos.length;i+=200){const{data,error}=await supabase.storage.from("fotos").createSignedUrls(caminhos.slice(i,i+200),3600);if(error)throw error;for(const u of data??[])if(u.path&&u.signedUrl)mapa.set(u.path as string,u.signedUrl as string)}return mapa}\n'
s = s.replace(anchor, helper, 1)

start = s.index(' useEffect(()=>{let ativo=true;')
end = s.index('\n const filtradas=useMemo', start)
new_effect = ''' useEffect(()=>{let ativo=true;(async()=>{const{data:a}=await supabase.auth.getUser();if(!a.user){router.replace("/login");return}const meuId=a.user.id;setUid(meuId);const[{data:rows,error},{data:cs},{data:resumos,error:erroResumo}]=await Promise.all([supabase.from("galerias").select("id,titulo,criado_em,capa,prova,limite,prazo,link_ate,tem_senha,cliente_id").eq("user_id",meuId).order("criado_em",{ascending:false}),supabase.from("clientes").select("id,nome,email,telefone").eq("user_id",meuId).order("nome"),supabase.rpc("resumo_storage_galerias")]);if(!ativo)return;if(error||erroResumo){setAviso("Não foi possível carregar suas galerias agora.");setCarregando(false);return}setClientes((cs??[]) as Cliente[]);const bases=rows??[],resumoPorId=new Map(((resumos??[]) as {galeria_id:string;qtd_fotos:number;arquivo_capa:string|null}[]).map(r=>[r.galeria_id,r]));const capas=bases.map(row=>{const r=resumoPorId.get(row.id as string),nome=r?.arquivo_capa??null;return nome?{id:row.id as string,nome}:null}).filter(Boolean) as {id:string;nome:string}[];let mapa=new Map<string,string>();try{const caminhos=capas.flatMap(c=>[`${meuId}/${c.id}/thumbs/${c.nome}`,`${meuId}/${c.id}/${c.nome}`]);if(caminhos.length)mapa=await assinarCaminhos(caminhos)}catch{}if(!ativo)return;const lista:Galeria[]=bases.map(row=>{const id=row.id as string,r=resumoPorId.get(id),nome=r?.arquivo_capa??null;return{id,titulo:(row.titulo as string)||"Galeria",criadoEm:(row.criado_em as string|null)??null,capa:(row.capa as string|null)??null,clienteId:(row.cliente_id as string|null)??null,arquivos:[],qtd:Number(r?.qtd_fotos??0),thumbUrl:nome?mapa.get(`${meuId}/${id}/thumbs/${nome}`):undefined,originalUrl:nome?mapa.get(`${meuId}/${id}/${nome}`):undefined,config:{prova:Boolean(row.prova),limite:(row.limite as number)??0,prazo:(row.prazo as string|null)??null,linkAte:(row.link_ate as string|null)??null,temSenha:Boolean(row.tem_senha)}}});const ids=lista.map(g=>g.id),ms:Record<string,Selecao>={};if(ids.length){const{data:ss}=await supabase.from("selecoes").select("galeria,fotos,finalizada,comentarios,atualizado_em").in("galeria",ids);for(const sel of ss??[])ms[sel.galeria]={fotos:(sel.fotos as string[])??[],finalizada:Boolean(sel.finalizada),comentarios:(sel.comentarios as Record<string,string>)??{},atualizadoEm:(sel.atualizado_em as string)??undefined}}if(ativo){setSelecoes(ms);setGalerias(lista);setCarregando(false)}})();return()=>{ativo=false}},[router,supabase]);'''
s = s[:start] + new_effect + s[end:]
s = s.replace('if(arquivos.length!==g.arquivos.length)setGalerias', 'if(arquivos.length!==g.qtd)setGalerias', 1)
p.write_text(s)

# Selecoes: poll only volatile selection rows instead of galleries + clients each minute.
p = Path('app/app/dashboard/selecoes/page.tsx')
s = p.read_text()
insert_at = s.index('\n  useEffect(() => { void carregar(false); }, [carregar]);')
incremental = r'''

  const atualizarSelecoes = useCallback(async () => {
    if (!itens.length) return;
    setAtualizando(true);
    const ids = itens.map((x) => x.id);
    const { data, error } = await supabase
      .from("selecoes")
      .select("galeria,fotos,finalizada,comentarios,atualizado_em")
      .in("galeria", ids);
    if (error) { setAtualizando(false); return; }
    const porGaleria = new Map((data ?? []).map((s) => [s.galeria as string, s]));
    setItens((atuais) => atuais.map((item) => {
      const s = porGaleria.get(item.id);
      if (!s) return { ...item, selecao: null, comentarios: 0, status: "sem_interacao" as const };
      const comentarios = (s.comentarios as Record<string, string> | null) ?? {};
      const selecao: Selecao = {
        fotos: (s.fotos as string[]) ?? [],
        finalizada: Boolean(s.finalizada),
        comentarios,
        atualizadoEm: (s.atualizado_em as string | null) ?? undefined,
      };
      return {
        ...item,
        selecao,
        comentarios: Object.values(comentarios).filter((t) => (t ?? "").trim()).length,
        status: selecao.finalizada ? "finalizada" as const : "andamento" as const,
      };
    }).sort((a,b)=>(b.selecao?.atualizadoEm??b.criadoEm??"").localeCompare(a.selecao?.atualizadoEm??a.criadoEm??"")));
    setAtualizando(false);
  }, [itens, supabase]);
'''
s = s[:insert_at] + incremental + s[insert_at:]
old = '''  useEffect(() => {
    const id = window.setInterval(() => { void carregar(true); }, 60_000);
    const aoVisivel = () => { if (document.visibilityState === "visible") void carregar(true); };
    document.addEventListener("visibilitychange", aoVisivel);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", aoVisivel);
    };
  }, [carregar]);'''
new = '''  useEffect(() => {
    const id = window.setInterval(() => { void atualizarSelecoes(); }, 60_000);
    const aoVisivel = () => { if (document.visibilityState === "visible") void atualizarSelecoes(); };
    document.addEventListener("visibilitychange", aoVisivel);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", aoVisivel);
    };
  }, [atualizarSelecoes]);'''
if old not in s:
    raise SystemExit('selection polling anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)

# Public gallery: let the browser skip layout/paint work for off-screen photo cards.
p = Path('app/app/g/[slug]/page.tsx')
s = p.read_text()
old = '.gc-card{position:relative;aspect-ratio:1;border:1px solid #1e2036;border-radius:16px;overflow:hidden;background:#12131f}'
new = '.gc-card{position:relative;aspect-ratio:1;border:1px solid #1e2036;border-radius:16px;overflow:hidden;background:#12131f;content-visibility:auto;contain-intrinsic-size:240px 240px}'
if old not in s:
    raise SystemExit('public card css anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)
