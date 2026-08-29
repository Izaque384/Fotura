import { expect, test } from "@playwright/test";
import { MAX_TAMANHO_ARQUIVO, validarArquivo } from "../../lib/upload-validation";

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
