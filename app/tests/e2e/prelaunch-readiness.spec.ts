import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");

test.describe("pré-lançamento Fotura",()=>{
  test("404 e erro global oferecem recuperação com a identidade do produto",async({request})=>{
    const resposta=await request.get("/rota-inexistente-prelaunch");
    expect(resposta.status()).toBe(404);
    const html=await resposta.text();
    expect(html).toContain("FOTURA");

    const notFound=read("app/not-found.tsx");
    const error=read("app/error.tsx");
    expect(notFound).toContain("PÁGINA NÃO ENCONTRADA");
    expect(notFound).toContain("Ir para o início");
    expect(error).toContain("Tentar novamente");
    expect(error).toContain("reset");
  });

  test("robots e metadados mantêm áreas privadas fora da indexação",()=>{
    const robots=read("app/robots.ts");
    for(const rota of ["/api/","/admin/","/dashboard/","/upload","/configuracoes","/perfil","/login"]){
      expect(robots).toContain(`"${rota}"`);
    }
    const projeto=read("app/p/[slug]/layout.tsx");
    const galeria=read("app/g/[slug]/layout.tsx");
    expect(projeto).toContain("index:false");
    expect(galeria).toContain("index: false");
  });

  test("manifesto, termos e privacidade permanecem presentes para lançamento",async({request})=>{
    const manifest=JSON.parse(read("public/manifest.json")) as {name?:string;icons?:unknown[];start_url?:string};
    expect(manifest.name).toContain("Fotura");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);

    const termos=await request.get("/pt/termos");
    const privacidade=await request.get("/pt/privacidade");
    expect(termos.ok()).toBeTruthy();
    expect(privacidade.ok()).toBeTruthy();
    expect(await termos.text()).toContain("Termos de Uso");
    expect(await privacidade.text()).toContain("Política de Privacidade");
  });

  test("uploads críticos são retomáveis e protegem navegação acidental",()=>{
    const upload=read("app/upload/page.tsx");
    const entrega=read("app/dashboard/entrega/[id]/page.tsx");
    for(const tela of [upload,entrega]){
      expect(tela).toContain("retryDelays");
      expect(tela).toContain("findPreviousUploads");
      expect(tela).toContain("resumeFromPreviousUpload");
      expect(tela).toContain("beforeunload");
    }
    expect(upload).toContain('window.addEventListener("offline"');
    expect(upload).toContain('window.addEventListener("online"');
  });

  test("ações destrutivas exigem confirmação e limitam abuso",()=>{
    const projeto=read("app/api/projeto/workspace/route.ts");
    const galeria=read("app/api/galeria/excluir/route.ts");
    const encerramento=read("app/api/account/closure/route.ts");

    expect(projeto).toContain("project_delete");
    expect(projeto).toContain("consumirRateLimit");
    expect(projeto).toContain("Digite o nome exato do projeto");
    expect(galeria).toContain("gallery_delete");
    expect(galeria).toContain("consumirRateLimit");
    expect(galeria).toContain("excluir_dados_galeria_backend");
    expect(encerramento).toContain('"ENCERRAR"');
    expect(encerramento).toContain("emailConfirmacao");
    expect(encerramento).toContain("PRAZO_SEGURANCA_DIAS");
  });

  test("falhas no núcleo de Projetos têm caminho explícito de recuperação",()=>{
    const lista=read("app/dashboard/projetos/page.tsx");
    const workspace=read("app/dashboard/projetos/[id]/page.tsx");
    expect(lista).toContain("Tentar novamente");
    expect(lista).toContain("void carregar()");
    expect(workspace).toContain("Não foi possível abrir o projeto");
    expect(workspace).toContain("Voltar para Projetos");
    expect(workspace).toContain("void carregar()");
  });
  test("fluxo do fotógrafo mantém contexto do projeto até a entrega",()=>{
    const projetos=read("app/dashboard/projetos/page.tsx");
    const workspace=read("app/dashboard/projetos/[id]/page.tsx");
    const upload=read("app/upload/page.tsx");
    const entrega=read("app/dashboard/entrega/[id]/page.tsx");
    const publico=read("app/p/[slug]/page.tsx");

    expect(projetos).toContain('router.push(`/dashboard/projetos/${d.projeto.id}`)');
    expect(workspace).toContain('router.push(`/upload?galeria=${d.pasta.id}&projeto=${id}`)');
    expect(upload).toContain("?aba=pastas");
    expect(workspace).toContain("Preparar entrega");
    expect(workspace).toContain("Continuar entrega");
    expect(entrega).toContain("?aba=entrega");
    expect(entrega).toContain("Publicar entrega");
    expect(publico).toContain("Um único link");
  });

  test("cobrança comunica estados de risco sem divergir dos limites",()=>{
    const billing=read("app/dashboard/assinatura/page.tsx");
    expect(billing).toContain("Existe uma pendência de pagamento");
    expect(billing).toContain("assinatura está programada para encerrar");
    expect(billing).toContain("plano Grátis");
    expect(billing).toContain("statusRestrito");
  });

});
