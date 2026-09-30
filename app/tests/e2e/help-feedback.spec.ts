import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

test.describe("ajuda e feedback", () => {
  test("área voluntária reúne ajuda, problemas, sugestões e feedback sem pop-ups", () => {
    const page = read("app/ajuda/page.tsx");
    expect(page).toContain("AJUDA E FEEDBACK");
    expect(page).toContain("Reportar problema");
    expect(page).toContain("Enviar sugestão");
    expect(page).toContain("Dar feedback");
    expect(page).toContain("Screenshot opcional");
    expect(page).toContain("Canal voluntário");
    expect(page).not.toContain("window.alert");
    expect(page).not.toContain("setTimeout(() => set");
  });

  test("envio de feedback é autenticado, limitado e mantém anexos privados", () => {
    const route = read("app/api/feedback/route.ts");
    expect(route).toContain("requisicaoMesmoOrigin");
    expect(route).toContain("feedback_submit");
    expect(route).toContain('"feedback-anexos"');
    expect(route).toContain("MAX_ARQUIVO = 5 * 1024 * 1024");
    expect(route).toContain("image/png");
    expect(route).toContain("image/jpeg");
    expect(route).toContain("image/webp");
  });

  test("admin consegue classificar mensagens em todo o ciclo", () => {
    const page = read("app/admin/feedback/page.tsx");
    const route = read("app/api/admin/feedback/route.ts");
    for (const status of ["novo", "analisando", "planejado", "resolvido"]) {
      expect(page).toContain(status);
      expect(route).toContain(status);
    }
    expect(route).toContain("registrarAdminAuditoria");
    expect(route).toContain("createSignedUrl");
  });

  test("menu oferece entrada voluntária e preserva a página de origem", () => {
    const menu = read("app/MenuFotografo.tsx");
    expect(menu).toContain('label: "Ajuda e feedback"');
    expect(menu).toContain('tipo: "ajuda"');
    expect(menu).toContain("origem=");
  });
});
