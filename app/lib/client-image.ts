export type ThumbnailWithMetadata={
  blob:Blob;
  largura:number;
  altura:number;
  thumbLargura:number;
  thumbAltura:number;
};

export function gerarMiniaturaComMetadata(
  arquivo:File,
  maxLado=800,
  qualidade=.76,
):Promise<ThumbnailWithMetadata|null>{
  return new Promise(resolve=>{
    const img=new Image();
    const url=URL.createObjectURL(arquivo);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const largura=img.naturalWidth;
      const altura=img.naturalHeight;
      let thumbLargura=largura,thumbAltura=altura;
      const escala=Math.min(1,maxLado/Math.max(thumbLargura,thumbAltura));
      thumbLargura=Math.max(1,Math.round(thumbLargura*escala));
      thumbAltura=Math.max(1,Math.round(thumbAltura*escala));
      const canvas=document.createElement("canvas");
      canvas.width=thumbLargura;canvas.height=thumbAltura;
      const ctx=canvas.getContext("2d");
      if(!ctx){resolve(null);return}
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.drawImage(img,0,0,thumbLargura,thumbAltura);
      canvas.toBlob(blob=>resolve(blob?{blob,largura,altura,thumbLargura,thumbAltura}:null),"image/jpeg",qualidade);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};
    img.src=url;
  });
}
