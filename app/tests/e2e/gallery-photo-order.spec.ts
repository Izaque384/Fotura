import { expect, test } from "@playwright/test";
import { ordenarFotos } from "../../lib/gallery-photo-order";

const fotos=[
  {name:"foto-10.jpg",criadoEm:"2026-10-01T10:00:00Z"},
  {name:"foto-2.jpg",criadoEm:"2026-10-03T10:00:00Z"},
  {name:"foto-1.jpg",criadoEm:"2026-10-02T10:00:00Z"},
];

test("ordenação de fotos preserva envio e oferece nome/data previsíveis",()=>{
  expect(ordenarFotos(fotos,"upload").map(x=>x.name)).toEqual(["foto-10.jpg","foto-2.jpg","foto-1.jpg"]);
  expect(ordenarFotos(fotos,"recentes").map(x=>x.name)).toEqual(["foto-2.jpg","foto-1.jpg","foto-10.jpg"]);
  expect(ordenarFotos(fotos,"nome_asc").map(x=>x.name)).toEqual(["foto-1.jpg","foto-2.jpg","foto-10.jpg"]);
  expect(ordenarFotos(fotos,"nome_desc").map(x=>x.name)).toEqual(["foto-10.jpg","foto-2.jpg","foto-1.jpg"]);
});
