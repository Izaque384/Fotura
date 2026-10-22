import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

test("manifesto do PWA mantém cores e ícones da nova abertura", async () => {
  const root = process.cwd();
  const manifest = JSON.parse(await fs.readFile(path.join(root, "public/manifest.json"), "utf8"));
  expect(manifest.background_color).toBe("#111222");
  expect(manifest.theme_color).toBe("#111222");
  expect(manifest.start_url).toBe("/dashboard");

  for (const size of [192, 512]) {
    const icon = manifest.icons.find((item: { sizes: string }) => item.sizes === `${size}x${size}`);
    expect(icon?.src).toBe(`/fotura-pwa-${size}-20261022.png`);
    const arquivo = path.join(root, "public", icon.src.slice(1));
    const foto = sharp(arquivo);
    const metadata = await foto.metadata();
    expect(metadata.width).toBe(size);
    expect(metadata.height).toBe(size);

    const canto = await foto.clone().extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    expect(Array.from(canto)).toEqual([17, 18, 34]);
  }

  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  expect(manifest.icons.some((item: { src: string; sizes: string }) => item.sizes === "512x512" && item.src.startsWith("/fotura-pwa-"))).toBe(true);
});

test("dashboard usa o mesmo carregamento do restante do Fotura", async () => {
  const root = process.cwd();
  const tela = await fs.readFile(path.join(root, "app/components/FoturaLoadingScreen.tsx"), "utf8");
  const dashboard = await fs.readFile(path.join(root, "app/dashboard/loading.tsx"), "utf8");
  expect(tela).toContain("Preparando seu espaço");
  expect(tela).toContain("#111222");
  expect(tela).toContain('url("/favicon.svg")');
  expect(tela).toContain("prefers-reduced-motion");
  expect(dashboard).toContain("FoturaLoadingScreen");
});
