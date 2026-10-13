export type Foto={
  url:string;
  thumb:string;
  nome:string;
  largura?:number;
  altura?:number;
  bytes?:number;
  mimeType?:string|null;
};

export type Perfil={nome:string|null;logo:string|null;cor:string|null};
export type Selecao={fotos:string[];finalizada:boolean;comentarios:Record<string,string>};

export type Meta={
  titulo:string;capa:string|null;prova:boolean;limite:number;prazo:string|null;linkAte:string|null;
  temSenha:boolean;desbloqueada:boolean;linkExpirado:boolean;vendaExtrasAtiva:boolean;
  precoFotoExtraCentavos:number|null;etapa:string;entregaPublicadaEm:string|null;
  downloadAtivo:boolean;downloadIndividual:boolean;downloadCompleto:boolean;
  downloadTamanho:"original"|"web";downloadPinNecessario:boolean;watermarkAtivo:boolean;
  watermarkTexto:string|null;watermarkOpacidade:number;assistenteAtivo:boolean;publicRef?:string;
};

export type ProjectClientContext={
  id:string;nome:string;descricao:string|null;capaUrl:string|null;studioName:string|null;
  heroColor:string;publicUrl:string;pastas:Array<{id:string;titulo:string}>;
  pastaAtivaId:string;onFolderChange:(id:string)=>void;
};

export type GallerySignedPayload={
  fotos:Foto[];
  capaUrl:string|null;
  etapa?:string;
  modo?:string;
  watermarkProtected?:boolean;
};
