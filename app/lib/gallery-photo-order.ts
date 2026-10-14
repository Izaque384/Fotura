export type OrdemFotos="upload"|"recentes"|"nome_asc"|"nome_desc";

export function ordemFotosValida(valor:unknown):valor is OrdemFotos{
  return valor==="upload"||valor==="recentes"||valor==="nome_asc"||valor==="nome_desc";
}

export function ordenarFotos<T extends {name:string;criadoEm?:string|null}>(fotos:T[],ordem:unknown):T[]{
  const lista=[...fotos];
  if(ordem==="recentes")return lista.sort((a,b)=>String(b.criadoEm??"").localeCompare(String(a.criadoEm??"")));
  if(ordem==="nome_asc")return lista.sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{numeric:true,sensitivity:"base"}));
  if(ordem==="nome_desc")return lista.sort((a,b)=>b.name.localeCompare(a.name,"pt-BR",{numeric:true,sensitivity:"base"}));
  return lista;
}
