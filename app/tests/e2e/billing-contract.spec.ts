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

    for (const codigo of ["gratis", "essencial", "profissional", "studio"] as const) {
      expect(PLANOS_FOTURA[codigo].limites.galeriasAtivas).toBeNull();
      expect(PLANOS_FOTURA[codigo].limites.clientes).toBeNull();
      expect(PLANOS_FOTURA[codigo].limites.fotosPorGaleria).toBeNull();
    }
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
    expect(sql).not.toContain("v_photo_limit");
    expect(sql).not.toContain("v_current_photos");
  });
});
