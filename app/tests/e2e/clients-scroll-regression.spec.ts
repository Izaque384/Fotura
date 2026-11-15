import { expect, test } from "@playwright/test";
import fs from "node:fs";

const clients = fs.readFileSync("app/dashboard/clientes/page.tsx", "utf8");
const drawer = fs.readFileSync("app/components/FoturaDrawer.tsx", "utf8");

test("cadastro e edição de clientes não empilham dois bloqueios de rolagem", () => {
  // O editor usa FoturaDrawer, que já faz o lock. A página bloqueia apenas
  // o backdrop da ficha, nunca ao abrir o formulário de cadastro.
  expect(clients).toContain("if (!selecionado || editor) return;");
  expect(clients).not.toContain("if (!selecionado && !editor) return;");
  expect(clients).toContain("}, [selecionado, editor]);");
  expect(clients).toContain("return () => { document.body.style.overflow = old; };");
  expect(clients).toContain('<FoturaDrawer');
  expect(drawer).toContain('document.body.style.overflow = "hidden"');
  expect(drawer).toContain("document.body.style.overflow = priorOverflow;");
});

test("mudar flags de salvamento ou exclusão não recria o scroll lock", () => {
  // A flag salvando muda imediatamente antes de abrir a ficha após cadastrar.
  // Um efeito de scroll dependente dela gravava overflow:hidden como estado
  // anterior, fazendo a aplicação continuar sem rolar após fechar o modal.
  const start = clients.indexOf('if (!selecionado || editor) return;');
  const end = clients.indexOf('// Reinstalar o atalho', start);
  expect(start).toBeGreaterThan(-1);
  const scrollEffect = clients.slice(start, end);
  expect(scrollEffect).not.toContain("salvando, excluindo");
  expect(clients).toContain("}, [selecionado, editor, salvando, excluindo]);");
  expect(clients).toContain("setEditor(null);\n      setSelecionado(salvo.id);");
});

test("abrir a ficha após cadastrar preserva saída pela tecla Escape e fechamento", () => {
  expect(clients).toContain('if (e.key === "Escape" && !salvando && !excluindo)');
  expect(clients).toContain('setSelecionado(null);\n        setConfirmarExclusao(false);');
  expect(clients).toContain('aria-label="Fechar ficha" onClick={() => setSelecionado(null)}');
});
