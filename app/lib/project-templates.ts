export type ModeloProjeto = "ensaio" | "casamento" | "entrega";
export type ConfigProjeto = {
 prova:boolean;limite:number;download_ativo:boolean;download_individual:boolean;
 download_completo:boolean;download_tamanho:"web"|"original";watermark_ativo:boolean;
 watermark_texto:string|null;watermark_opacidade:number;assistente_ativo:boolean;
};
export const MODELOS_PROJETO:Record<ModeloProjeto,{nome:string;descricao:string;config:ConfigProjeto}>={
 ensaio:{nome:"Ensaio com seleção",descricao:"Cliente escolhe e comenta as fotos antes da entrega.",config:{prova:true,limite:0,download_ativo:true,download_individual:true,download_completo:true,download_tamanho:"web",watermark_ativo:true,watermark_texto:null,watermark_opacidade:22,assistente_ativo:true}},
 casamento:{nome:"Casamento com pastas",descricao:"Organize etapas do evento e entregue pelo mesmo link.",config:{prova:false,limite:0,download_ativo:true,download_individual:true,download_completo:true,download_tamanho:"web",watermark_ativo:false,watermark_texto:null,watermark_opacidade:22,assistente_ativo:true}},
 entrega:{nome:"Entrega direta",descricao:"Fotos prontas, sem etapa de seleção.",config:{prova:false,limite:0,download_ativo:true,download_individual:true,download_completo:true,download_tamanho:"web",watermark_ativo:false,watermark_texto:null,watermark_opacidade:22,assistente_ativo:true}},
};
export function modeloValido(x:unknown):x is ModeloProjeto{return x==="ensaio"||x==="casamento"||x==="entrega"}
/** Validação explícita: nenhum modelo pode alterar IDs, cobrança, senha ou propriedade do projeto. */
export function configProjeto(x:unknown):ConfigProjeto|null{
 if(!x||typeof x!=="object"||Array.isArray(x))return null;
 const v=x as Record<string,unknown>;
 const bs=["prova","download_ativo","download_individual","download_completo","watermark_ativo","assistente_ativo"];
 if(bs.some(k=>typeof v[k]!=="boolean"))return null;
 if(!Number.isInteger(v.limite)||Number(v.limite)<0||Number(v.limite)>100000)return null;
 if(v.download_tamanho!=="web"&&v.download_tamanho!=="original")return null;
 if(!Number.isInteger(v.watermark_opacidade)||Number(v.watermark_opacidade)<5||Number(v.watermark_opacidade)>70)return null;
 if(v.watermark_texto!==null&&(typeof v.watermark_texto!=="string"||(v.watermark_texto as string).length>80))return null;
 return {prova:v.prova as boolean,limite:v.limite as number,download_ativo:v.download_ativo as boolean,download_individual:v.download_individual as boolean,download_completo:v.download_completo as boolean,download_tamanho:v.download_tamanho as "web"|"original",watermark_ativo:v.watermark_ativo as boolean,watermark_texto:v.watermark_texto as string|null,watermark_opacidade:v.watermark_opacidade as number,assistente_ativo:v.assistente_ativo as boolean};
}
