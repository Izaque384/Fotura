import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const app = path.join(process.cwd(), "app");
const read = (relative:string) => fs.readFileSync(path.join(app, relative), "utf8");

test.describe("landing hero", () => {
  test("usa uma única fotografia emocional sem cards flutuantes", () => {
    const home = read("HomeClient.tsx");
    const theme = read("lavanda-moderna.css");

    expect(home).toContain('className="hero-showcase-photo"');
    expect(home).toContain('aria-label="Casal de noivos em um momento íntimo ao pôr do sol"');
    expect(home).not.toContain("hero-gallery-card");
    expect(home).not.toContain("hero-proof-card");
    expect(home).not.toContain("hero-showcase-glow");

    expect(theme).toContain("landing/fotura-wedding-sunset-generated.png");
    expect(theme).not.toContain(".hero-gallery-card");
    expect(theme).not.toContain(".hero-proof-card");
    expect(theme).not.toContain(".hero-showcase-glow");
  });
});
