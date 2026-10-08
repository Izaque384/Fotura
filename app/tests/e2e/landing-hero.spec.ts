import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const app = path.join(process.cwd(), "app");
const read = (relative:string) => fs.readFileSync(path.join(app, relative), "utf8");

test.describe("landing hero", () => {
  test("mantém a composição editorial de três fotos sem rotação", () => {
    const home = read("HomeClient.tsx");
    const theme = read("landing-editorial.css");

    expect(home).toContain('className="lp2-photo lp2-hero-main"');
    expect(home).toContain('className="lp2-photo lp2-hero-tall"');
    expect(home).toContain('className="lp2-photo lp2-hero-small"');
    expect(theme).toContain("@keyframes lp2HeroPhotoFade");
    expect(theme).not.toContain("lp2HeroPhotoRotate");
    expect(theme).not.toContain("lp2SaturnOrbit");
    expect(home).not.toContain("lp2-orbit-stage");
  });
});
