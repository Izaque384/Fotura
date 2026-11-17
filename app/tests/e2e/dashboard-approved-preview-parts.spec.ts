import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");
const sidebar = readFileSync("app/MenuFotografo.tsx", "utf8");
const usage = readFileSync("app/dashboard/StorageUsageIndicator.tsx", "utf8");
const sidebarCss = readFileSync("app/internal-sidebar-premium.css", "utf8");
const overviewCss = readFileSync("app/dashboard/overview-premium.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

test.describe("Painel real com elementos aprovados da prévia", () => {
  test("preserva estrutura e funcionalidades reais sem importar dados ilustrativos", () => {
    expect(dashboard).toContain('className="dash mf-shift ft-overview-premium"');
    expect(dashboard).toContain("<MenuFotografo/>");
    expect(dashboard).toContain("<StorageUsageIndicator/>");
    expect(dashboard).toContain("<DashboardActionCenter/>");
    expect(dashboard).toContain("calcularGraficosDashboard(projetosMetricos,galerias,selecoes,visaoGraficos)");
    expect(dashboard).toContain("setVisaoGraficos(\"pastas\")");
    expect(dashboard).toContain('aria-expanded={sinoAberto}');
    expect(dashboard).toContain("onClick={abrirSino}");
    expect(dashboard).toContain("onClick={marcarNotificacoesComoLidas}");
    expect(dashboard).toContain("onClick={()=>router.push(\"/dashboard/projetos?novo=1\")}");
    expect(dashboard).toContain("p.capaUrl?<img");
    expect(dashboard).toContain("g.capaUrl?<img");
    expect(dashboard).toContain("onClick={()=>router.push(`/dashboard/projetos/${p.id}`)}");
    expect(dashboard).not.toContain("Estúdio Aurora");
    expect(dashboard).not.toContain("Dados ilustrativos");
    expect(dashboard).not.toContain("Seu trabalho, em números.");
    expect(dashboard).not.toContain("Etapa consolidada de cada projeto");
    expect(dashboard).not.toContain("criados nos últimos 6 meses");
    expect(dashboard).not.toContain("ÚLTIMOS 6 MESES");
  });

  test("menu conserva os botões, suas rotas e permissões", () => {
    expect(sidebar).toContain("itensPrincipais.map");
    expect(sidebar).toContain("itensSecundarios.map");
    expect(sidebar).toContain('className="mf-item mf-admin"');
    expect(sidebar).toContain("onClick={sair}");
    expect(sidebar).toContain('aria-current={perfilAtivo?"page":undefined}');
    expect(sidebar).toContain("onClick={()=>router.push(withLocalePath(\"/perfil\", locale))}");
    expect(sidebarCss).not.toContain("content:");
    expect(sidebarCss).toContain(".mf-side");
    expect(sidebarCss).toContain(".mf-top-user");
  });

  test("armazenamento usa dados reais e mantém o clique no plano", () => {
    expect(usage).toContain('fetch("/api/billing/usage"');
    expect(usage).toContain('className={`storage-usage${alerta');
    expect(usage).toContain("formatarUso(usadoBytes)");
    expect(usage).toContain("onClick={() => router.push(\"/dashboard/assinatura\")}");
    expect(usage).toContain("${percentual}% de ${limiteGb} GB");
  });

  test("estilos importados e restritos ao panorama e ao menu", () => {
    expect(layout).toContain('import "./internal-sidebar-premium.css"');
    expect(layout).toContain('import "./dashboard/overview-premium.css"');
    expect(overviewCss).toContain(".ft-overview-premium");
    expect(overviewCss).toContain(".overview-section");
    expect(overviewCss).toContain(".daily-section");
    expect(overviewCss).toContain(".list-cover");
    expect(overviewCss).toContain("prefers-reduced-motion:reduce");
  });

  test("acabamento da prévia aplica-se a cartões, sininho e menu, sem mudar dados", async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><style>
      .mf-side{position:fixed;left:0;top:0;width:236px;padding:16px;background:white}
      .mf-item{border:1px solid transparent;padding:10px}
      .mf-top-user{border:0;padding:10px}
      .dash-body{margin-left:236px;padding:30px}
      .card{border-radius:16px;background:#f4eff9;border:1px solid #ddd;padding:12px}
      .bell{border:1px solid #ddd}
      ${sidebarCss}
      ${overviewCss}
    </style></head><body style="margin:0"><div class="dash mf-shift ft-overview-premium">
      <aside class="mf-side"><button class="mf-brand"><span class="mf-brand-tx">FOTURA</span></button>
        <nav class="mf-nav"><button class="mf-item ativo">Painel</button><button class="mf-item">Projetos</button></nav>
      </aside>
      <button class="mf-top-user"><div class="mf-top-avatar"></div><div class="mf-top-user-info"><div class="mf-top-greeting">Olá, Estúdio</div><div class="mf-top-role">Fotógrafo</div></div></button>
      <main class="dash-body">
        <button class="storage-usage"><span class="storage-usage__head">ARMAZENAMENTO</span><span class="storage-usage__meta"><strong>1,46 GB</strong></span></button>
        <button class="bell" aria-label="Atividade recente"><svg viewBox="0 0 24 24"><path d="M1 1"/></svg></button>
        <div class="overview-section"><div class="overview-eyebrow">PANORAMA DO ESTÚDIO</div>
          <section class="charts"><article class="card"><span class="card-eyebrow">01 / EVOLUÇÃO</span><div class="card-t">Total de projetos</div></article></section>
        </div>
        <section class="daily-section"><span class="overview-eyebrow">NO DIA A DIA</span><div class="lists"><article class="card"><img class="list-cover" alt="Capa"></article></div></section>
      </main>
    </div></body></html>`);
    await expect(page.locator(".mf-side")).toHaveCSS("background-color", "rgb(23, 23, 29)");
    await expect(page.locator(".mf-top-user")).toHaveCSS("border-top-left-radius", "18px");
    await expect(page.locator(".charts .card")).toHaveCSS("border-top-left-radius", "23px");
    await expect(page.locator(".list-cover")).toHaveCSS("width", "62px");
    await expect(page.locator(".bell")).toHaveCSS("width", "47px");
    await expect(page.locator(".storage-usage")).toHaveCSS("border-top-left-radius", "13px");
    await expect(page.getByText("PANORAMA DO ESTÚDIO")).toBeVisible();
    await expect(page.getByText("NO DIA A DIA")).toBeVisible();
  });
});
