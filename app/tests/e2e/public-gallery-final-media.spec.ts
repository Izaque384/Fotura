import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { variantePublicaDaGaleria } from "../../lib/public-gallery-media-variant";

type FakeDb = Parameters<typeof variantePublicaDaGaleria>[0];
const makeGallery = (overrides: Partial<Parameters<typeof variantePublicaDaGaleria>[1]> = {}) => ({
  id: "00000000-0000-4000-8000-000000000001",
  etapa: "entrega",
  prova: false,
  entrega_publicada_em: "2026-11-15T13:56:18Z",
  ...overrides,
});

function dbStub(finals: string[], selected: boolean | null = null, catalogError = false) {
  const calls: string[] = [];
  let activeTable = "";
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    async limit() {
      if (activeTable !== "galeria_foto_metadata") throw Error("Unexpected table: " + activeTable);
      return { data: finals.map(nome => ({ nome })), error: catalogError ? new Error("catalog not available") : null };
    },
    async maybeSingle() {
      if (activeTable !== "selecoes") throw Error("Unexpected table: " + activeTable);
      return { data: selected === null ? null : { finalizada: selected }, error: null };
    },
  };
  const db = {
    from(table: string) {
      activeTable = table;
      calls.push(table);
      return builder;
    },
  } as unknown as FakeDb;
  return { db, calls };
}

test("prova ainda não entregue continua lendo mídia da prova", async () => {
  const { db, calls } = dbStub(["final.jpg"], true);
  expect(await variantePublicaDaGaleria(db, makeGallery({ etapa: "preparando_entrega" }))).toBe("principal");
  expect(calls).toHaveLength(0);
});

test("entrega direta continua usando galeria principal", async () => {
  const { db, calls } = dbStub([], null);
  expect(await variantePublicaDaGaleria(db, makeGallery({ entrega_publicada_em: null }))).toBe("principal");
  expect(calls).toHaveLength(0);
});

test("publicação de uma seleção com 28 fotos finais usa exclusivamente /entrega", async () => {
  const { db, calls } = dbStub(["foto-editada.jpg"]);
  expect(await variantePublicaDaGaleria(db, makeGallery())).toBe("entrega");
  expect(calls).toEqual(["galeria_foto_metadata"]);
});

test("seleção antiga finalizada sem metadados ainda usa entrega", async () => {
  const { db, calls } = dbStub([], true);
  expect(await variantePublicaDaGaleria(db, makeGallery())).toBe("entrega");
  expect(calls).toEqual(["galeria_foto_metadata", "selecoes"]);
});

test("sem entrega final nem seleção, mídia principal permanece intacta", async () => {
  const { db } = dbStub([], null);
  expect(await variantePublicaDaGaleria(db, makeGallery())).toBe("principal");
});

test("falha ao consultar registro final não pode expor fotos da prova por fallback", async () => {
  const { db } = dbStub([], null, true);
  await expect(variantePublicaDaGaleria(db, makeGallery())).rejects.toThrow("catalog not available");
});

test("todos os links públicos e downloads usam a mesma decisão de mídia", () => {
  const signed = fs.readFileSync("app/api/fotos/signed/route.ts", "utf8");
  const download = fs.readFileSync("app/api/galeria/download/route.ts", "utf8");
  const project = fs.readFileSync("app/api/projeto/publico/route.ts", "utf8");
  const gallery = fs.readFileSync("app/g/[slug]/page.tsx", "utf8");
  for (const route of [signed, download, project]) {
    expect(route).toContain('variantePublicaDaGaleria');
    expect(route).toContain('"/entrega"');
  }
  expect(signed).not.toContain('etapa === "entrega" && Boolean(g.prova)');
  expect(download).not.toContain('g.prova && etapa === "entrega" ?');
  expect(gallery).toContain('finalizada&&meta.etapa!=="entrega"');
  expect(gallery).toContain('meta.prova&&meta.etapa!=="entrega"&&meta.prazo');
});
