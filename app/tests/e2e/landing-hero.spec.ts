import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const app = path.join(process.cwd(), "app");
const read = (relative: string) => fs.readFileSync(path.join(app, relative), "utf8");

test.describe("landing hero", () => {
  test("apresenta pôster editorial e vídeo opcional sem transições giratórias", () => {
    const home = read("HomeClient.tsx");
    const video = read("components/LandingHeroVideo.tsx");
    const theme = read("landing-editorial.css");
    expect(home).toContain("<LandingHeroVideo />");
    expect(home).toContain('className="lp2-hero lp2-hero-cinematic"');
    expect(video).toContain('className="lp2-hero-poster"');
    expect(video).toContain('className={"lp2-hero-video" + (reproduzindo ? " is-playing" : "")}');
    expect(video).toContain("prefers-reduced-motion");
    expect(video).toContain("saveData");
    expect(theme).not.toContain("lp2HeroPhotoRotate");
    expect(theme).not.toContain("lp2SaturnOrbit");
    expect(home).not.toContain("lp2-orbit-stage");
  });
});
