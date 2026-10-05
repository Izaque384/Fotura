import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PLANOS_FOTURA } from "../../lib/billing-plans";

test.describe("contrato de planos e armazenamento", () => {
  test("mantém os limites comerciais atuais em uma única fonte de verdade", () => {
    expect(PLANOS_FOTURA.gratis.limites.armazenamentoGb).toBe(1);
    expect(PLANOS_FOTURA.essencial.limites.armazenamentoGb).toBe(10);
    expect(PLANOS_FOTURA.profissional.limites.armazenamentoGb).toBe(50);
    expect(PLANOS_FOTURA.studio.limites.armazenamentoGb).toBe(100);


    expect(PLANOS_FOTURA.gratis.recursos.heroEstudio).toBe(false);
    expect(PLANOS_FOTURA.gratis.recursos.heroPremiumTech).toBe(false);
    expect(PLANOS_FOTURA.gratis.recursos.heroFotoGaleria).toBe(false);

    expect(PLANOS_FOTURA.essencial.recursos.heroEstudio).toBe(true);
    expect(PLANOS_FOTURA.essencial.recursos.heroPremiumTech).toBe(false);
    expect(PLANOS_FOTURA.essencial.recursos.heroFotoGaleria).toBe(false);

    for (const codigo of ["profissional", "studio"] as const) {
      expect(PLANOS_FOTURA[codigo].recursos.heroEstudio).toBe(true);
      expect(PLANOS_FOTURA[codigo].recursos.heroPremiumTech).toBe(true);
      expect(PLANOS_FOTURA[codigo].recursos.heroFotoGaleria).toBe(true);
    }

    const landing = fs.readFileSync(
      path.join(process.cwd(), "app", "HomeClient.tsx"),
      "utf8",
    );
    expect(landing).toContain('\"100 GB de armazenamento\"');

    for (const codigo of ["gratis", "essencial", "profissional", "studio"] as const) {
      expect(PLANOS_FOTURA[codigo].limites.galeriasAtivas).toBeNull();
      expect(PLANOS_FOTURA[codigo].limites.clientes).toBeNull();
      expect(PLANOS_FOTURA[codigo].limites.fotosPorGaleria).toBeNull();
    }
  });

  test("capa da galeria é a única fonte da foto de fundo do hero", () => {
    const signed = fs.readFileSync(
      path.join(process.cwd(), "app", "api", "fotos", "signed", "route.ts"),
      "utf8",
    );
    const galerias = fs.readFileSync(
      path.join(process.cwd(), "app", "dashboard", "galerias", "page.tsx"),
      "utf8",
    );
    const perfil = fs.readFileSync(
      path.join(process.cwd(), "app", "perfil", "page.tsx"),
      "utf8",
    );

    expect(signed).toContain("hero_foto_capa_ativo");
    expect(signed).toContain("plano.recursos.heroFotoGaleria");
    expect(signed).not.toContain("Boolean(g.hero_fundo_foto)");

    expect(galerias).toContain("Define a imagem de identificação da galeria");
    expect(galerias).toContain("Profissional ou Studio");
    expect(perfil).toContain("Usar a capa da galeria como fundo do hero");
    expect(perfil).not.toContain('router.push("/dashboard/heros")');
  });

  test("SQL de Storage acompanha os planos e não reintroduz limite oculto de fotos", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "sql", "planos_storage_only_2026.sql"),
      "utf8",
    );

    expect(sql).toContain("when 'gratis' then 1");
    expect(sql).toContain("when 'essencial' then 10");
    expect(sql).toContain("when 'profissional' then 50");
    expect(sql).toContain("when 'studio' then 100");
    expect(sql).toContain("assinaturas_plano_codigo_check");
    expect(sql).toContain("'sem_plano','gratis','legacy','essencial','profissional','studio'");
    expect(sql).not.toContain("v_photo_limit");
    expect(sql).not.toContain("v_current_photos");
  });
});
