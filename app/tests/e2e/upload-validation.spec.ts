import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { MAX_TAMANHO_ARQUIVO, mesclarArquivosSelecionados, validarArquivo } from "../../lib/upload-validation";
import { explicarFalhaUpload } from "../../lib/upload-failure";

function arquivo(name: string, type: string, size: number) {
  return { name, type, size };
}

test("aceita os formatos de imagem suportados", () => {
  expect(validarArquivo(arquivo("foto.jpg", "image/jpeg", 1024))).toBeNull();
  expect(validarArquivo(arquivo("foto.JPEG", "image/jpeg", 1024))).toBeNull();
  expect(validarArquivo(arquivo("foto.png", "image/png", 1024))).toBeNull();
  expect(validarArquivo(arquivo("foto.webp", "image/webp", 1024))).toBeNull();
});

test("rejeita extensão não permitida", () => {
  expect(validarArquivo(arquivo("arquivo.exe", "application/octet-stream", 10))).toContain("formato não aceito");
});

test("rejeita MIME incompatível com a extensão", () => {
  expect(validarArquivo(arquivo("foto.jpg", "text/plain", 10))).toBe("tipo do arquivo não corresponde à extensão");
});

test("rejeita arquivo vazio e arquivo acima de 50 MB", () => {
  expect(validarArquivo(arquivo("foto.jpg", "image/jpeg", 0))).toBe("arquivo vazio");
  expect(validarArquivo(arquivo("foto.jpg", "image/jpeg", MAX_TAMANHO_ARQUIVO + 1))).toBe("arquivo maior que 50 MB");
});

test("rejeita nomes inseguros ou excessivamente longos", () => {
  expect(validarArquivo(arquivo("pasta/foto.jpg", "image/jpeg", 10))).toBe("nome do arquivo inválido");
  expect(validarArquivo(arquivo(`${"a".repeat(181)}.jpg`, "image/jpeg", 10))).toBe("nome do arquivo muito longo");
  expect(validarArquivo(arquivo("sem-extensao", "image/jpeg", 10))).toBe("extensão ausente ou inválida");
});


test("acumula seleções sucessivas sem duplicar arquivos", () => {
  const a = { name: "a.jpg", type: "image/jpeg", size: 10, lastModified: 1 };
  const b = { name: "b.jpg", type: "image/jpeg", size: 20, lastModified: 2 };
  const c = { name: "c.jpg", type: "image/jpeg", size: 30, lastModified: 3 };
  const resultado = mesclarArquivosSelecionados([a, b], [b, c], 500);
  expect(resultado.arquivos.map(x => x.name)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  expect(resultado.duplicados.map(x => x.name)).toEqual(["b.jpg"]);
  expect(resultado.excedentes).toHaveLength(0);
});

test("respeita o limite total ao somar novas seleções", () => {
  const a = { name: "a.jpg", type: "image/jpeg", size: 10, lastModified: 1 };
  const b = { name: "b.jpg", type: "image/jpeg", size: 20, lastModified: 2 };
  const c = { name: "c.jpg", type: "image/jpeg", size: 30, lastModified: 3 };
  const resultado = mesclarArquivosSelecionados([a, b], [c], 2);
  expect(resultado.arquivos.map(x => x.name)).toEqual(["a.jpg", "b.jpg"]);
  expect(resultado.excedentes.map(x => x.name)).toEqual(["c.jpg"]);
});


test("seletor de fotos aguarda confirmação nativa e mantém fallback", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "upload", "page.tsx"), "utf8");
  expect(source).toContain("showOpenFilePicker");
  expect(source).toContain("multiple:true");
  expect(source).toContain('error.name==="AbortError"');
  expect(source).toContain("inputRef.current?.click()");
  expect(source).toContain("Selecionar fotos");
  expect(source).not.toContain("Você pode abrir o seletor quantas vezes precisar");
  expect(source).not.toContain("JPG, PNG ou WebP · até 50 MB por foto");
});

test("detalha falhas de upload sem revelar URLs assinadas ou segredos", () => {
  expect(explicarFalhaUpload(new Error("Envio R2 falhou (HTTP 403)."))).toContain("HTTP 403");
  expect(explicarFalhaUpload(new Error("Falha de rede durante o envio R2."))).toContain("conexão");
  expect(explicarFalhaUpload(new Error("Limite de armazenamento atingido."))).toBe("Limite de armazenamento atingido.");
  const mensagem = explicarFalhaUpload(new Error("SignatureDoesNotMatch https://private.example/?X-Amz-Signature=secret"));
  expect(mensagem).not.toContain("https://");
  expect(mensagem).not.toContain("secret");
});

test("limite do R2 respeita grandes lotes sem bloquear 74 fotos e distingue ações", () => {
  const route = fs.readFileSync(path.join(process.cwd(), "app", "api", "fotos", "r2", "route.ts"), "utf8");
  expect(route).not.toContain('consumirRateLimit(req, "r2_photo_write", auth.user.id, 600, 150)');
  expect(route).toContain('scope: "r2_photo_prepare", limit: 750');
  expect(route).toContain('scope: "r2_photo_multipart", limit: 6500');
  expect(route).toContain('scope: "r2_photo_verify", limit: 2500');
  expect(route).toContain('scope: "r2_photo_finalize", limit: 1500');
  expect(route).toContain('code: "UPLOAD_RATE_LIMIT"');
  expect(explicarFalhaUpload(new Error("Limite temporário de operações de upload atingido."))).toContain("Limite temporário");
  expect(explicarFalhaUpload(new Error("Limite de solicitações atingido."))).toContain("Limite de solicitações");
});

test("upload não repete nome quando o projeto e a galeria têm o mesmo título", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "upload", "page.tsx"), "utf8");
  expect(source).toContain('projetoNome.trim().toLocaleLowerCase("pt-BR")!==tituloTravado.trim().toLocaleLowerCase("pt-BR")');
  expect(source).toContain("<span>Projeto: {projetoNome}</span>");
  expect(source).not.toContain("<span>{projetoNome}</span>");
  expect(source).toContain("explicarFalhaUpload(e)");
});
