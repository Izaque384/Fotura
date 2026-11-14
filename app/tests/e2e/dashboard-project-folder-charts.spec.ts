import { expect, test } from "@playwright/test";
import fs from "node:fs";
import {
  calcularGraficosDashboard,
  estadoProjetoGrafico,
  type PastaGrafico,
  type ProjetoGrafico,
} from "../../lib/dashboard-chart-data";

const projetos: ProjetoGrafico[] = [
  { id: "projeto-entregue", criadoEm: "2026-09-12T15:00:00Z", prova: false },
  { id: "projeto-selecao", criadoEm: "2026-10-03T15:00:00Z", prova: true },
  { id: "projeto-preparando", criadoEm: "2026-11-02T15:00:00Z", prova: false },
  { id: "projeto-vazio", criadoEm: "2026-11-11T15:00:00Z", prova: false },
];
const pastas: PastaGrafico[] = [
  { id: "g1", projetoId: "projeto-entregue", criadoEm: "2026-09-12T15:00:00Z", prova: false, etapa: "entrega" },
  { id: "g2", projetoId: "projeto-entregue", criadoEm: "2026-09-13T15:00:00Z", prova: false, etapa: "entrega" },
  { id: "g3", projetoId: "projeto-selecao", criadoEm: "2026-10-03T15:00:00Z", prova: true, etapa: "prova" },
  { id: "g4", projetoId: "projeto-preparando", criadoEm: "2026-11-02T15:00:00Z", prova: false, etapa: "preparando_entrega" },
  { id: "g5", projetoId: null, criadoEm: "2026-11-06T15:00:00Z", prova: false, etapa: "prova" },
];
const agora = new Date("2026-11-14T12:00:00Z");
const status = (rows: ReturnType<typeof calcularGraficosDashboard>) =>
  Object.fromEntries(rows.categorias.map(item => [item.chave, item.qtd]));

test("projetos são contados uma vez mesmo quando têm várias pastas", () => {
  const metricas = calcularGraficosDashboard(projetos, pastas, {}, "projetos", agora);
  expect(metricas.total).toBe(4);
  expect(metricas.ultimosSeisMeses).toBe(4);
  expect(metricas.meses.map(item => item.qtd)).toEqual([0,0,0,1,1,2]);
  expect(status(metricas)).toMatchObject({
    aguardando: 1, selecao: 0, preparando: 1, entregue: 1, andamento: 0, sem_pastas: 1,
  });
  expect(metricas.categorias.reduce((total,item)=>total+item.qtd,0)).toBe(metricas.total);
});

test("pastas são contadas individualmente, inclusive sem vínculo com projeto", () => {
  const metricas=calcularGraficosDashboard(projetos, pastas, {}, "pastas", agora);
  expect(metricas.total).toBe(5);
  expect(metricas.categorias.some(item=>item.chave==="sem_pastas")).toBe(false);
  expect(status(metricas)).toMatchObject({
    aguardando: 1, selecao: 0, preparando: 1, entregue: 2, andamento: 1,
  });
  expect(metricas.categorias.reduce((total,item)=>total+item.qtd,0)).toBe(metricas.total);
});

test("seleção finalizada prevalece e projetos sem pastas não são considerados entregues", () => {
  const metricas=calcularGraficosDashboard(projetos,pastas,{g3:{finalizada:true}},"projetos",agora);
  expect(status(metricas).selecao).toBe(1);
  expect(status(metricas).aguardando).toBe(0);
  expect(estadoProjetoGrafico(projetos[3], [], {})).toBe("sem_pastas");
});

test("gráficos vazios e meses na virada do ano não inventam contagens", () => {
  const vazio=calcularGraficosDashboard([],[],{},"projetos",agora);
  expect(vazio.total).toBe(0);
  expect(vazio.categorias.every(item=>item.qtd===0)).toBe(true);
  const janeiro=calcularGraficosDashboard(
    [{id:"p",criadoEm:"2025-12-05T12:00:00Z",prova:false}],[],{},
    "projetos",new Date("2026-01-20T12:00:00Z"),
  );
  expect(janeiro.meses.slice(-2).map(item=>item.qtd)).toEqual([1,0]);
  expect(janeiro.ultimosSeisMeses).toBe(1);
});

test("painel permite alternar projetos e pastas sem mudar a lista recente nem buscar imagens extras", () => {
  const page=fs.readFileSync("app/dashboard/page.tsx","utf8");
  expect(page).toContain('setVisaoGraficos("projetos")');
  expect(page).toContain('setVisaoGraficos("pastas")');
  expect(page).toContain("calcularGraficosDashboard(projetosMetricos,galerias,selecoes,visaoGraficos)");
  expect(page).toContain("setProjetosMetricos(projetosBase.map");
  expect(page).toContain("setProjetosRecentes(projetosBase.slice(0,2).map");
  expect(page).toContain("const capasProjetos=projetosBase.slice(0,2)");
  expect(page).not.toContain('.limit(2)]');
});
