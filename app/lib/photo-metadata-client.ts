export type FotoMetadataInput={
  nome:string;
  largura:number|null;
  altura:number|null;
  bytes:number;
  mimeType:string|null;
  thumbBytes:number|null;
};

export async function registrarMetadadosFotos(
  token:string,
  galeria:string,
  variante:"principal"|"entrega",
  fotos:FotoMetadataInput[],
){
  if(!token||!galeria||!fotos.length)return false;
  for(let tentativa=0;tentativa<2;tentativa++){
    try{
      const resposta=await fetch("/api/fotos/metadata",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({galeria,variante,fotos}),
      });
      if(resposta.ok)return true;
      if(resposta.status<500)return false;
    }catch{}
    if(tentativa===0)await new Promise(resolve=>setTimeout(resolve,500));
  }
  return false;
}
