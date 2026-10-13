import type { Foto } from "./gallery-types";

export function distribuirFotosPorAltura(fotos:Foto[],quantidade:number){
  const colunas=Array.from({length:Math.max(1,quantidade)},()=>[] as Array<{f:Foto;i:number}>);
  const alturas=Array.from({length:colunas.length},()=>0);
  for(let i=0;i<fotos.length;i++){
    const foto=fotos[i];
    const proporcao=foto.largura&&foto.altura?foto.altura/foto.largura:.75;
    let destino=0;
    for(let c=1;c<colunas.length;c++)if(alturas[c]<alturas[destino])destino=c;
    colunas[destino].push({f:foto,i});
    alturas[destino]+=proporcao+.002;
  }
  return colunas;
}
