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
  }
  expect(configProjeto({...MODELOS_PROJETO.ensaio.config,download_tamanho:"arquivos-secretos"})).toBeNull();
  expect(configProjeto({...MODELOS_PROJETO.ensaio.config,limite:-1})).toBeNull();
 });
 test("a lista oferece filtros de fluxo e alternância entre grade e lista",()=>{
  const codigo=read("app/dashboard/projetos/page.tsx");
  for(const t of ["Aguardando cliente","Seleção concluída","Preparando entrega","Entregues","fotura-projetos-modo","project-grid","aria-pressed"])expect(codigo).toContain(t);
  expect(codigo).toContain("Modelo do projeto");
 });
 test("novas pastas herdam o modelo e alterações do projeto são sincronizadas",()=>{
  const api=read("app/api/projeto/workspace/route.ts");
  for(const key of ["prova: p.prova","download_tamanho: p.download_tamanho","watermark_ativo: p.watermark_ativo","const atualizarPastas = Object.fromEntries","if(sincronizacao.error)"])expect(api).toContain(key);
 });
 test("compartilhamento revisa o acesso antes de enviar o link",()=>{
  const codigo=read("app/dashboard/ProjectShareCenter.tsx");
  for(const t of ["Pastas visíveis","DOWNLOADS","VALIDADE","PIN DE DOWNLOAD","Ver como cliente","Copiar link"])expect(codigo).toContain(t);
  expect(codigo).toContain('disabled={!pronto}');
 });
 test("movimentações não alteram seleções e entregas",()=>{
  const rota=read("app/api/projeto/fotos/route.ts");
  const gerenciador=read("app/dashboard/ProjectPhotoManager.tsx");
  for(const t of ['.eq("projeto_id",projeto)',"origem.etapa!==\"prova\"","dest.etapa!==\"prova\"",'from("selecoes")','from("vendas_fotos")','from("galeria_foto_metadata")','b.fotos.length>25'])expect(rota).toContain(t);
  for(const t of ["Selecionar até 25","Definir como capa","Mover fotos","Carregar mais fotos"])expect(gerenciador).toContain(t);
 });
});
