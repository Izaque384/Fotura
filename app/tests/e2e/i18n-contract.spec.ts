import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeLocale,
  localeFromAcceptLanguage,
  stripLocalePrefix,
  translate,
  withLocalePath,
} from "../../lib/i18n";

test.describe("contrato de internacionalização", () => {
  test("resolve PT, EN e ES e preserva rotas localizadas", () => {
    expect(normalizeLocale("pt-BR")).toBe("pt");
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("es-MX")).toBe("es");
    expect(localeFromAcceptLanguage("fr-FR,es;q=0.9,en;q=0.8")).toBe("es");

    expect(stripLocalePrefix("/en/dashboard/galerias")).toBe("/dashboard/galerias");
    expect(withLocalePath("/dashboard/galerias?x=1#topo", "es")).toBe("/es/dashboard/galerias?x=1#topo");
  });

  test("mantém traduções essenciais disponíveis nos três idiomas", () => {
    expect(translate("en", "Criar conta")).toBe("Create account");
    expect(translate("es", "Criar conta")).toBe("Crear cuenta");
    expect(translate("en", "Sua entrega está pronta")).toBe("Your delivery is ready");
    expect(translate("es", "Sua entrega está pronta")).toBe("Tu entrega está lista");
    expect(translate("en", "Redefinir senha")).toBe("Reset password");
    expect(translate("es", "Redefinir senha")).toBe("Restablecer contraseña");
  });

  test("cadastro e e-mails carregam o idioma da conta", () => {
    const login = fs.readFileSync(path.join(process.cwd(), "app", "login", "page.tsx"), "utf8");
    const enviar = fs.readFileSync(path.join(process.cwd(), "app", "api", "galeria", "enviar", "route.ts"), "utf8");
    const entrega = fs.readFileSync(path.join(process.cwd(), "app", "api", "galeria", "entrega", "route.ts"), "utf8");
    const proxy = fs.readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8");

    expect(login).toContain("language: locale");
    expect(enviar).toContain("configs.idioma");
    expect(enviar).toContain('translate(locale,"Sua galeria")');
    expect(entrega).toContain("configs.idioma");
    expect(entrega).toContain('translate(locale,"Sua entrega está pronta")');
    expect(proxy).toContain("localeFromAcceptLanguage");
    expect(proxy).toContain("withLocalePath");
  });
});
