import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

test.describe("contratos de maturidade operacional", () => {
  test("dependências críticas permanecem em versões corrigidas", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string,string>; devDependencies?: Record<string,string> };
    expect(pkg.dependencies?.next).toBe("16.3.8");
    expect(pkg.devDependencies?.["eslint-config-next"]).toBe("16.3.8");
  });

  test("exportação de dados evita credenciais e segredos operacionais", () => {
    const source = read("app/api/account/export/route.ts");
    expect(source).toContain("fotura-dados-");
    expect(source).toContain("clientes");
    expect(source).toContain("galerias");
    expect(source).toContain("selecoes");
    expect(source).toContain("vendas");
    expect(source).not.toContain("access_token_encrypted");
    expect(source).not.toContain("refresh_token_encrypted");
    expect(source).not.toContain("p256dh");
    expect(source).not.toContain("stripe_payment_intent_id");
  });

  test("encerramento do titular mantém período de segurança e confirmação forte", () => {
    const source = read("app/api/account/closure/route.ts");
    expect(source).toContain("PRAZO_SEGURANCA_DIAS = 7");
    expect(source).toContain('trim().toUpperCase() !== "ENCERRAR"');
    expect(source).toContain("emailConfirmacao");
    expect(source).toContain("requisicaoMesmoOrigin");
    expect(source).toContain("assinaturaAtiva");
    expect(source).toContain("aplicar_takedown_publico_backend");
    expect(source).not.toContain("deleteUser");
    expect(source).not.toContain("executarPurgeDefinitivo");
  });

  test("configurações expõem portabilidade e encerramento reversível", () => {
    const source = read("app/configuracoes/page.tsx");
    expect(source).toContain("Exportar meus dados");
    expect(source).toContain("Encerrar conta");
    expect(source).toContain("Conta administrativa.");
    expect(source).toContain("transfira o controle administrativo");
    expect(source).toContain("Cancelar solicitação");
    expect(source).toContain("Digite ENCERRAR");
  });

  test("saúde operacional valida dependências e prepara comparação de restore", () => {
    const source = read("app/api/admin/saude/route.ts");
    expect(source).toContain("https://api.stripe.com/v1/account");
    expect(source).toContain("https://api.resend.com/domains");
    expect(source).toContain("operational_recovery_snapshot_backend");
  });

  test("upload continua resumível e preserva arquivos que falharam", () => {
    const source = read("app/upload/page.tsx");
    expect(source).toContain("new tus.Upload");
    expect(source).toContain("retryDelays:[0,1000,3000,5000,10000]");
    expect(source).toContain("resumeFromPreviousUpload");
    expect(source).toContain("setArquivos(falhas)");
    expect(source).toContain("A galeria vazia foi descartada");
  });

  test("contas suspensas são bloqueadas no login e em sessões já abertas", () => {
    const login = read("app/login/page.tsx");
    const menu = read("app/MenuFotografo.tsx");
    expect(login).toContain("body.suspensao?.ativa");
    expect(menu).toContain("body.suspensao?.ativa");
    expect(menu).toContain('/login?suspensa=1');
  });
});
