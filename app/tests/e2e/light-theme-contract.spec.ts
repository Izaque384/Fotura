import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "app");

function read(relative: string) {
  return fs.readFileSync(path.join(APP, relative), "utf8");
}

test.describe("contrato visual claro do Fotura", () => {
  test("não carrega as camadas legadas de tema", () => {
    const layout = read("layout.tsx");
    expect(layout).not.toContain('import "./premium.css"');
    expect(layout).not.toContain('import "./premium-tuning.css"');
    expect(layout).not.toContain('import "./ux-refinements.css"');

    expect(fs.existsSync(path.join(APP, "premium.css"))).toBe(false);
    expect(fs.existsSync(path.join(APP, "premium-tuning.css"))).toBe(false);
    expect(fs.existsSync(path.join(APP, "ux-refinements.css"))).toBe(false);
  });

  test("globals não reintroduz tema escuro automático nem overrides do app", () => {
    const globals = read("globals.css");
    expect(globals).not.toContain("prefers-color-scheme: dark");
    expect(globals).not.toContain(".mf-shift .card");
    expect(globals).not.toContain("#0a0a0a");
  });

  test("telas internas principais não usam os fundos escuros legados", () => {
    const files = [
      "MenuFotografo.tsx",
      "dashboard/page.tsx",
      "dashboard/galerias/page.tsx",
      "dashboard/selecoes/page.tsx",
      "dashboard/clientes/page.tsx",
      "dashboard/assinatura/page.tsx",
      "dashboard/entrega/[id]/page.tsx",
      "dashboard/onboarding/page.tsx",
      "dashboard/heros/page.tsx",
      "configuracoes/page.tsx",
      "perfil/page.tsx",
      "upload/page.tsx",
      "components/ModalSelecao.tsx",
      "components/ConfirmDialog.tsx",
      "admin/page.tsx",
      "admin/analytics/page.tsx",
      "admin/saude/page.tsx",
      "admin/lancamento/page.tsx",
      "admin/auditoria/page.tsx",
      "admin/contas/[id]/page.tsx",
      "admin/contas/[id]/AdminActions.tsx",
      "admin/contas/[id]/AdminClosure.tsx",
    ];

    const legacyDarkSurfaces = [
      "#090917",
      "#0e0e20",
      "#0b0b1a",
      "#101024",
      "#14142b",
      "#101023",
      "#111124",
      "#111126",
      "#0f0f1a",
      "#0d0d1e",
    ];

    for (const file of files) {
      const source = read(file).toLowerCase();
      for (const color of legacyDarkSurfaces) {
        expect(source, `${file} ainda contém ${color}`).not.toContain(color);
      }
    }
  });

  test("admin de produto usa a paleta lavanda clara", () => {
    const analytics = read("admin/analytics/page.tsx");
    expect(analytics).toContain("#F0EDF7");
    expect(analytics).toContain("#FAF8FD");
    expect(analytics).toContain("#DCD6EE");
    expect(analytics).toContain("#21253A");
  });
});
