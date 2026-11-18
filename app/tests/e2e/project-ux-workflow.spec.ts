import {test,expect} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {MODELOS_PROJETO,configProjeto} from "../../lib/project-templates";

const root=process.cwd();
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");

test.describe("Fotura: UX dos projetos",()=>{
 test("modelos possuem configurações válidas e não carregam credenciais",()=>{
  for(const modelo of Object.values(MODELOS_PROJETO)){
   expect(configProjeto(modelo.config)).not.toBeNull();
   expect(JSON.stringify(modelo.config)).not.toContain("senha");
   expect(JSON.stringify(modelo.config)).not.toContain("cliente_id");
   expect(modelo.config.download_tamanho).toBe("original");
   expect(modelo.config.watermark_ativo).toBe(false);
  }
  expect(configProjeto({...MODELOS_PROJETO.ensaio.config,download_tamanho:"arquivos-secretos"})).toBeNull();
  expect(configProjeto({...MODELOS_PROJETO.ensaio.config,download_tamanho:"web",watermark_ativo:true})?.download_tamanho).toBe("original");
  expect(configProjeto({...MODELOS_PROJETO.ensaio.config,download_tamanho:"web",watermark_ativo:true})?.watermark_ativo).toBe(false);
  expect(configProjeto({...MODELOS_PROJETO.ensaio.config,limite:-1})).toBeNull();
 });
 test("a grade fotográfica preserva filtros, fluxo e acesso direto ao workspace",()=>{
  const codigo=read("app/dashboard/projetos/page.tsx");
  for(const t of ["Aguardando cliente","Seleção concluída","Preparando entrega","Entregues","project-list project-grid","import Link from \"next/link\"","aria-label={`Abrir projeto ${p.nome}`}"])expect(codigo).toContain(t);
  expect(codigo).not.toContain('fotura-projetos-modo');
  expect(codigo).not.toContain('Visualização dos projetos');
  expect(codigo).not.toContain('setProjetoDetalhes');
  expect(codigo).toContain("fluxoProjeto");
  expect(codigo).toContain("estruturaProjeto");
 });
 test("novas pastas herdam o modelo e alterações do projeto são sincronizadas",()=>{
  const api=read("app/api/projeto/workspace/route.ts");
  for(const key of ["prova: p.prova","download_tamanho: p.download_tamanho","watermark_ativo: p.watermark_ativo","const atualizarPastas = Object.fromEntries","if (compartilhados.error)","if (provasAbertas.error)"])expect(api).toContain(key);
 });
 test("compartilhamento revisa o acesso antes de enviar o link",()=>{
  const codigo=read("app/dashboard/ProjectShareCenter.tsx");
  for(const t of ["Galerias visíveis para o cliente","DOWNLOADS","VALIDADE","PIN DE DOWNLOAD","Ver como cliente","Copiar link"])expect(codigo).toContain(t);
  expect(codigo).toContain('disabled={!pronto}');
 });
 test("movimentações não alteram seleções e entregas",()=>{
  const rota=read("app/api/projeto/fotos/route.ts");
  const gerenciador=read("app/dashboard/ProjectPhotoManager.tsx");
  for(const t of ['.eq("projeto_id",projeto)',"origem.etapa!==\"prova\"","dest.etapa!==\"prova\"",'from("selecoes")','from("vendas_fotos")','from("galeria_foto_metadata")','b.fotos.length>25'])expect(rota).toContain(t);
  for(const t of ["Selecionar até 25","Definir como capa","Mover fotos","Carregar mais fotos"])expect(gerenciador).toContain(t);
 });
 test("contagem do workspace inclui mídia final do R2 e não anuncia galeria entregue como vazia",()=>{
  const api=read("app/api/projeto/workspace/route.ts");
  const pagina=read("app/dashboard/projetos/[id]/page.tsx");
  const contador=api.split("async function contarFotos(")[1]?.split("async function urlCapa(")[0]??"";
  expect(contador).toContain("listarCatalogoGaleriaHibrido");
  expect(contador).not.toContain('supabase.rpc("listar_fotos_galeria_storage"');
  expect(contador).toContain("if (error || !data) throw");
  expect(api).toContain("project.workspace.photo_count");
  const proximoPasso=pagina.split("const proximoPasso =")[1]?.split("function irParaGalerias()")[0]??"";
  expect(proximoPasso.indexOf("entregues===dados.pastas.length")).toBeGreaterThanOrEqual(0);
  expect(proximoPasso.indexOf("entregues===dados.pastas.length")).toBeLessThan(proximoPasso.indexOf("totalFotos===0"));
  expect(pagina).toContain('galeriaPrincipal?.etapa==="entrega"?"Sua galeria foi entregue"');
  expect(pagina).toContain('galeriaPrincipal.etapa==="entrega"?"· Entrega publicada"');
 });
});
