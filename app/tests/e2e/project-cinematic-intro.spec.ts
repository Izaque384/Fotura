import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { lerAbertura, validarAbertura } from "../../lib/cinematic-intro";
import { validarMp4ParaWeb } from "../../lib/mp4-compatibility";

const uuid = "1e86ef4c-501b-46e8-8ea9-8032554e9d9c";
const folder = "304c3059-9afd-492f-ac93-8d286840f16e";
const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const exemplo = {
  projeto: {
    id: uuid,
    nome: "Casamento de Ana e Pedro",
    descricao: "Uma tarde para lembrar",
    publicRef: "casamento-ana-pedro-1e86ef4c",
    capaUrl: null,
    temSenha: false,
    desbloqueado: true,
    linkExpirado: false,
    abertura: {
      ativo: true,
      estilo: "cinematografico",
      duracao: 30,
      frase: "Alguns momentos merecem ser revividos.",
      fotos: [{ pastaId: folder, arquivo: "foto-01.jpg", url: transparentPixel }],
      versao: "2026-10-22T14:30:00.000Z",
    },
  },
  perfil: { nome: "Ateliê", logo: null, cor: "#111222" },
  pastas: [{ id: folder, titulo: "Cerimônia", ordem: 0, etapa: "entrega", thumbnailUrl: transparentPixel }],
};

test("valida duração, fotos e mantém a configuração desativada por padrão", () => {
  expect(lerAbertura(null).ativo).toBe(false);
  expect(lerAbertura(null).duracao).toBe(21);
  expect(lerAbertura({ duracao: 6 }).duracao).toBe(21);
  expect(lerAbertura({ duracao: 4 }).duracao).toBe(15);
  expect(lerAbertura({ duracao: 8 }).duracao).toBe(15);
  expect(lerAbertura({ duracao: 12 }).duracao).toBe(21);
  expect(lerAbertura({ duracao: 16 }).duracao).toBe(30);
  expect(validarAbertura({ ...exemplo.projeto.abertura, duracao: 30 })?.duracao).toBe(30);
  expect(validarAbertura({ ...exemplo.projeto.abertura, fotos: [] })).toBeNull();
  expect(validarAbertura({ ...exemplo.projeto.abertura, duracao: 150 })).toBeNull();
  expect(validarAbertura({ ...exemplo.projeto.abertura, fotos: [{ pastaId: folder, arquivo: "../segredo" }] })).toBeNull();
  expect(validarAbertura({ ...exemplo.projeto.abertura })?.ativo).toBe(true);
});

test("verifica codec real H.264 e MP4 Fast Start, não só a extensão", () => {
  function box(type: string, body: Uint8Array): Uint8Array {
    const out = new Uint8Array(8 + body.length);
    new DataView(out.buffer).setUint32(0, out.length);
    out.set([...type].map((x) => x.charCodeAt(0)), 4);
    out.set(body, 8);
    return out;
  }
  function concat(...items: Uint8Array[]): Uint8Array {
    const result = new Uint8Array(items.reduce((n, item) => n + item.length, 0));
    let offset = 0;
    for (const item of items) { result.set(item, offset); offset += item.length; }
    return result;
  }
  function video(codec: string) {
    const ftyp = box("ftyp", new Uint8Array([105,115,111,109,0,0,0,1]));
    const sample = box(codec, new Uint8Array(12));
    const stsdPayload = new Uint8Array(8 + sample.length);
    new DataView(stsdPayload.buffer).setUint32(4, 1);
    stsdPayload.set(sample, 8);
    const moov = box("moov", box("stsd", stsdPayload));
    const mdat = box("mdat", new Uint8Array(8));
    return { ftyp, moov, mdat };
  }
  const valido = video("avc1");
  expect(validarMp4ParaWeb(concat(valido.ftyp, valido.moov, valido.mdat))).toBeNull();
  const hevc = video("hvc1");
  expect(validarMp4ParaWeb(concat(hevc.ftyp, hevc.moov, hevc.mdat))).toMatch(/H.264/);
  expect(validarMp4ParaWeb(concat(valido.ftyp, valido.mdat, valido.moov))).toMatch(/Fast Start/);
  expect(validarMp4ParaWeb(new Uint8Array(48))).toMatch(/MP4/);
});

test("abertura reaparece no link em cada visita, e permite voltar, avançar e pular", async ({ page }) => {
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(exemplo) }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(tela).toBeVisible();
  await expect(page.getByText("Alguns momentos merecem ser revividos.")).toBeVisible();
  await expect(page.locator(".fci-intro h1.fci-title")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.locator(".fci-eyebrow")).toHaveCSS("color", "rgb(246, 244, 255)");
  await expect(page.locator(".fci-images img")).toHaveCSS("transition-duration", "2.15s");
  await expect(tela.locator(".fci-progress i")).toHaveCount(3);
  await expect(tela.locator(".fci-bottom")).toBeVisible();
  await expect(tela.getByText("UMA EXPERIÊNCIA FOTURA")).toHaveCount(0);
  await expect(tela.locator(".fci-controls")).toHaveCount(0);
  await expect(tela.locator(".fci-bottom")).toHaveText("");
  await expect(tela.getByText("3 de 3")).toHaveCount(0);
  await expect(tela.getByText("Explorar fotografias")).toHaveCount(0);
  // O único botão visível é o de pular a introdução, no canto superior.
  await expect(tela.getByRole("button")).toHaveCount(1);

  const viewport = page.viewportSize()!;
  const esquerda = viewport.width * 0.24;
  const direita = viewport.width * 0.76;
  const y = viewport.height * 0.55;
  await page.mouse.click(direita, y);
  await expect(tela.getByRole("heading", { name: exemplo.projeto.nome })).toBeVisible();
  await page.mouse.click(esquerda, y);
  await expect(tela.getByRole("heading", { name: exemplo.projeto.abertura.frase })).toBeVisible();
  await page.mouse.click(direita, y);
  await page.mouse.click(direita, y);
  await expect(tela.getByText(exemplo.projeto.descricao)).toBeVisible();
  await expect(tela.getByText("Sua história começa aqui.")).toHaveCount(0);
  // A última cena também avança para a galeria, sem mostrar CTA.
  await page.mouse.click(direita, y);
  await expect(tela).toHaveCount(0);
  await expect(page.getByText("Escolha uma galeria")).toBeVisible();
  await page.reload();
  await expect(tela).toBeVisible();
  await expect(tela.getByRole("heading", { name: exemplo.projeto.abertura.frase })).toBeVisible();
  await page.getByRole("button", { name: /Pular introdução/ }).click();
  await expect(page.getByText("Escolha uma galeria")).toBeVisible();
});

test("navegação por áreas funciona no viewport mobile e pelas setas do teclado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(exemplo) }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(tela).toBeVisible();
  await page.mouse.click(320, 430);
  await expect(tela.getByRole("heading", { name: exemplo.projeto.nome })).toBeVisible();
  await page.mouse.click(70, 430);
  await expect(tela.getByRole("heading", { name: exemplo.projeto.abertura.frase })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tela.getByRole("heading", { name: exemplo.projeto.nome })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(tela.getByRole("heading", { name: exemplo.projeto.abertura.frase })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(tela.getByText(exemplo.projeto.descricao)).toBeVisible();
  await page.getByRole("button", { name: /Pular introdução/ }).click();
  await expect(tela).toHaveCount(0);
});

test("terceira cena sem descrição não usa texto genérico", async ({ page }) => {
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, descricao: "   " } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(tela).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(tela.getByText("SUAS FOTOGRAFIAS")).toBeVisible();
  await expect(tela.locator(".fci-description")).toHaveCount(0);
  await expect(tela.getByText("Sua história começa aqui.")).toHaveCount(0);
});

test("terceira cena suporta descrições extensas sem cortar texto", async ({ page }) => {
  const descricaoLonga = "Descrição personalizada para o cliente. ".repeat(14).trim();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, descricao: descricaoLonga } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  await expect(page.getByRole("dialog", { name: "Apresentação do projeto" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const descricao = page.locator(".fci-description");
  await expect(descricao).toHaveText(descricaoLonga);
  await expect(descricao).toHaveCSS("overflow-y", "auto");
  await expect(descricao).toHaveCSS("white-space", "pre-line");
});

test("descrição da abertura usa tipografia editorial leve no iPhone sem alterar os títulos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto,
      descricao: "Uma história de amor, encontros e instantes que merecem ser lembrados por muitos anos." } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(tela).toBeVisible();
  await expect(tela.locator(".fci-title")).toHaveCSS("font-family", /Sora/i);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const descricao = tela.locator(".fci-description");
  await expect(descricao).toBeVisible();
  await expect(descricao).toHaveCSS("font-family", /Newsreader/i);
  await expect(descricao).toHaveCSS("font-weight", "300");
  const tamanho = await descricao.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(tamanho).toBeGreaterThanOrEqual(21);
  expect(tamanho).toBeLessThanOrEqual(25);
});

test("cabe nome completo do estúdio no topo mobile e botão pular é discreto", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const nomeEstudio = "ALVOR FOTOGRAFIA E FILMES";
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, perfil: { ...exemplo.perfil, nome: nomeEstudio } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(tela).toBeVisible();
  const estudio = tela.locator(".fci-studio");
  const pular = tela.getByRole("button", { name: "Pular introdução" });
  await expect(estudio).toHaveText(nomeEstudio);
  await expect(estudio).toHaveCSS("white-space", "normal");
  await expect(estudio).toHaveCSS("text-overflow", "clip");
  await expect(pular).toBeVisible();
  const box = await estudio.boundingBox();
  const btn = await pular.boundingBox();
  expect(box).not.toBeNull();
  expect(btn).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(btn!.x + 1);
  expect(box!.height).toBeGreaterThan(20);
  await expect(pular).toHaveCSS("outline-style", "none");
  await pular.click();
  await expect(tela).toHaveCount(0);
});

test("projeto protegido não exibe fotos da introdução antes de desbloquear", async ({ page }) => {
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, temSenha: true, desbloqueado: false, abertura: { ...exemplo.projeto.abertura, ativo: false, fotos: [] } }, pastas: [] }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  await expect(page.getByText("PROJETO PROTEGIDO")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Apresentação do projeto" })).toHaveCount(0);
});

test("projeto sem abertura continua indo diretamente para as galerias", async ({ page }) => {
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, abertura: { ...exemplo.projeto.abertura, ativo: false } } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  await expect(page.getByRole("dialog", { name: "Apresentação do projeto" })).toHaveCount(0);
  await expect(page.getByText("Escolha uma galeria")).toBeVisible();
});


test("prévia usa portal e atualiza links das fotografias antes de reproduzir", () => {
  const componente = fs.readFileSync("app/components/ProjectCinematicIntro.tsx", "utf8");
  const editor = fs.readFileSync("app/dashboard/ProjectCinematicSettings.tsx", "utf8");
  expect(componente).toContain('import { createPortal } from "react-dom"');
  expect(componente).toContain("document.body");
  expect(editor).toContain("porPasta[pastaId] = await buscar(pastaId)");
  expect(editor).toContain("setPasta((anterior)");
  expect(editor).toContain("setPreview({ fotos: selecionadas, videoUrl })");
});

test("configura vídeo sem permitir caminhos arbitrários nem remover o fallback fotográfico", () => {
  const user = "bd405340-330c-4118-9279-5e4e53c7a516";
  const project = "b522c88a-8bb1-41b8-93b9-46f0d21627b3";
  const object = "36e51be3-3e7a-4423-bfd7-e23f78892ec0";
  const path = `${user}/${project}/${object}.mp4`;
  const base = exemplo.projeto.abertura;
  expect(validarAbertura({ ...base, fundo: "video", video: path })?.video).toBe(path);
  expect(validarAbertura({ ...base, fundo: "video", video: path })?.fundo).toBe("video");
  expect(validarAbertura({ ...base, fundo: "video", video: null })).toBeNull();
  expect(validarAbertura({ ...base, fundo: "video", video: "../../secret.mp4" })).toBeNull();
  expect(validarAbertura({ ...base, fundo: "video", video: "https://outro.site/video.mp4" })).toBeNull();
  expect(lerAbertura({ ...base, fundo: "video", video: path }).fotos).toHaveLength(1);
  expect(lerAbertura(base).fundo).toBe("fotos");
});

test("vídeo não exibe a fotografia da capa enquanto carrega ou durante buffering", async ({ page }) => {
  const videoUrl = "https://example.supabase.co/storage/v1/object/sign/abertura-videos/cinematic.mp4?token=test";
  let responderVideo: (() => void) | undefined;
  await page.route("**/cinematic.mp4?**", async (route) => {
    await new Promise<void>((resolve) => { responderVideo = resolve; });
    await route.abort().catch(() => {});
  });
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ...exemplo,
      projeto: { ...exemplo.projeto, abertura: {
        ...exemplo.projeto.abertura,
        fundo: "video", video: null, videoUrl,
      } },
    }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c", { waitUntil: "domcontentloaded" });
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  const video = tela.locator(".fci-video");
  await expect(video).toHaveCount(1);
  await expect(tela.locator(".fci-images img")).toHaveCount(0);
  await expect(video).not.toHaveAttribute("poster");
  // O elemento deve ser visível ANTES de 'playing' para que o Safari permita autoplay.
  await expect(video).toHaveCSS("opacity", "1");
  await expect(video).toHaveCSS("background-color", "rgb(11, 11, 18)");
  expect(await video.evaluate((el) => ({
    autoplay: (el as HTMLVideoElement).autoplay,
    muted: (el as HTMLVideoElement).muted,
    playsInline: (el as HTMLVideoElement).playsInline,
  }))).toEqual({ autoplay: true, muted: true, playsInline: true });
  await video.dispatchEvent("waiting");
  await expect(video).toHaveCSS("opacity", "1");
  await expect(tela.locator(".fci-images img")).toHaveCount(0);
  await video.dispatchEvent("error");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveCSS("opacity", "0");
  await expect(tela.locator(".fci-images img")).toHaveCount(1);
  responderVideo?.();
});

test("Safari: interrupção temporária do autoplay não troca o vídeo por fotos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(
      new DOMException("The play() request was interrupted", "AbortError")
    );
  });
  await page.route("**/cinematic.mp4?**", async () => {});
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, abertura: {
      ...exemplo.projeto.abertura, fundo: "video",
      videoUrl: "https://example.supabase.co/storage/v1/object/sign/abertura-videos/cinematic.mp4?token=test",
    } } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c", { waitUntil: "domcontentloaded" });
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  const video = tela.locator(".fci-video");
  await expect(video).toHaveCount(1);
  await video.dispatchEvent("canplay");
  await expect(video).toHaveCSS("opacity", "1");
  await expect(tela.locator(".fci-images img")).toHaveCount(0);
  await expect(tela.getByRole("button")).toHaveCount(1); // apenas pular, sem reprodução manual
});

test("Safari: bloqueio real do autoplay preserva fotos como fallback, sem adicionar botão", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(
      new DOMException("Autoplay is not allowed", "NotAllowedError")
    );
  });
  await page.route("**/cinematic.mp4?**", async () => {});
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, abertura: {
      ...exemplo.projeto.abertura, fundo: "video",
      videoUrl: "https://example.supabase.co/storage/v1/object/sign/abertura-videos/cinematic.mp4?token=test",
    } } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c", { waitUntil: "domcontentloaded" });
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  const video = tela.locator(".fci-video");
  await expect(tela.locator(".fci-images img")).toHaveCount(1);
  await expect(video).toHaveCount(1);
  await expect(video).toHaveCSS("opacity", "0");
  await expect(tela.getByRole("button")).toHaveCount(1);
});

test("iPhone sem botão: toque na própria abertura recupera vídeo com autoplay bloqueado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    let calls = 0;
    HTMLMediaElement.prototype.play = function () {
      calls += 1;
      if (calls === 1) return Promise.reject(new DOMException("Autoplay is blocked", "NotAllowedError"));
      this.dispatchEvent(new Event("playing"));
      return Promise.resolve();
    };
  });
  await page.route("**/cinematic.mp4?**", async () => {});
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ...exemplo, projeto: { ...exemplo.projeto, abertura: {
      ...exemplo.projeto.abertura, fundo: "video",
      videoUrl: "https://example.supabase.co/storage/v1/object/sign/abertura-videos/cinematic.mp4?token=test",
    } } }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c", { waitUntil: "domcontentloaded" });
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  const video = tela.locator(".fci-video");
  await expect(tela.locator(".fci-images img")).toHaveCount(1);
  await expect(video).toHaveCSS("opacity", "0");
  await page.mouse.click(320, 430);
  await expect(video).toHaveCSS("opacity", "1");
  await expect(tela.locator(".fci-images img")).toHaveCount(0);
  await expect(tela.getByRole("button")).toHaveCount(1);
});

test("movimento reduzido e economia de rede não impedem a tentativa do MP4", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true, value: { saveData: true, effectiveType: "3g" },
    });
  });
  await page.route("**/cinematic.mp4?**", async () => {});
  await page.route("**/api/projeto/publico?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      ...exemplo,
      projeto: { ...exemplo.projeto, abertura: {
        ...exemplo.projeto.abertura, fundo: "video", video: null,
        videoUrl: "https://example.supabase.co/storage/v1/object/sign/abertura-videos/cinematic.mp4?token=test",
      } },
    }),
  }));
  await page.goto("/p/casamento-ana-pedro-1e86ef4c");
  const tela = page.getByRole("dialog", { name: "Apresentação do projeto" });
  await expect(tela).toBeVisible();
  await expect(tela.locator(".fci-video")).toHaveCount(1);
  await expect(tela.locator(".fci-video")).toHaveCSS("opacity", "1");
  await expect(tela.locator(".fci-images img")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(tela.getByRole("heading", { name: exemplo.projeto.nome })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tela.getByText(exemplo.projeto.descricao)).toBeVisible();
  await page.getByRole("button", { name: "Pular introdução" }).click();
  await expect(tela).toHaveCount(0);
});

test("o upload do vídeo exige autorização e os projetos privados não recebem URL antecipadamente", () => {
  const apiPublica = fs.readFileSync("app/api/projeto/publico/route.ts", "utf8");
  const endpoint = fs.readFileSync("app/api/projeto/video/route.ts", "utf8");
  expect(apiPublica).toContain('abertura.fundo === "video" && desbloqueada && !linkExpirado');
  expect(apiPublica).toContain("video: null");
  expect(endpoint).toContain("requisicaoMesmoOrigin(req)");
  expect(endpoint).toContain("createSignedUploadUrl(path)");
  expect(endpoint).toContain("registrar_video_abertura_upload_backend");
  expect(endpoint).toContain("VIDEO_ABERTURA_MAX_BYTES");
});

test("vídeos exigem um Bearer válido e respeitam a franquia de armazenamento", () => {
  const endpoint = fs.readFileSync("app/api/projeto/video/route.ts", "utf8");
  expect(endpoint).toContain(String.raw`match(/^Bearer\s+(.+)$/i)`);
  expect(endpoint).not.toContain(String.raw`match(/^Bearer\\s+(.+)$/i)`);
  expect(endpoint).toContain("contextoPlano(db, userId)");
  expect(endpoint).toContain("contexto.uso.armazenamentoBytes + bytes");
});

test("exclusão definitiva limpa vídeos e o limite do plano os contabiliza", () => {
  const purge = fs.readFileSync("lib/admin-purge-executor.ts", "utf8");
  const migracao = fs.readFileSync("../supabase/migrations/20261025150000_count_cinematic_videos_in_storage.sql", "utf8");
  expect(purge).toContain("storageRemovido.videosAbertura = await removerPrefixoStorage");
  expect(purge).toContain("VIDEO_ABERTURA_BUCKET");
  expect(migracao).toContain("'abertura-videos'");
  expect(migracao).toContain("billing_usage_backend");
});
