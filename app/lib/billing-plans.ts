export type PlanoCodigo = "sem_plano" | "legacy" | "essencial" | "profissional" | "studio";

export type PlanoFotura = {
  codigo: PlanoCodigo;
  nome: string;
  descricao: string;
  precoMensalCentavos: number | null;
  limites: {
    galeriasAtivas: number | null;
    armazenamentoGb: number | null;
    clientes: number | null;
    fotosPorGaleria: number | null;
  };
  recursos: {
    selecaoProva: boolean;
    comentarios: boolean;
    senhaGaleria: boolean;
    entregaFinal: boolean;
    envioEmail: boolean;
    brandingPersonalizado: boolean;
    heroEstudio: boolean;
    heroPremiumTech: boolean;
    notificacoesPush: boolean;
  };
};

export const PLANOS_FOTURA: Record<PlanoCodigo, PlanoFotura> = {
  sem_plano: {
    codigo: "sem_plano",
    nome: "Sem plano",
    descricao: "Escolha um plano para começar a usar os recursos comerciais do Fotura.",
    precoMensalCentavos: null,
    limites: {
      galeriasAtivas: 0,
      armazenamentoGb: 0,
      clientes: 0,
      fotosPorGaleria: 0,
    },
    recursos: {
      selecaoProva: false,
      comentarios: false,
      senhaGaleria: false,
      entregaFinal: false,
      envioEmail: false,
      brandingPersonalizado: false,
      heroEstudio: false,
      heroPremiumTech: false,
      notificacoesPush: false,
    },
  },
  legacy: {
    codigo: "legacy",
    nome: "Legacy",
    descricao: "Acesso preservado para contas existentes antes da monetização.",
    precoMensalCentavos: null,
    limites: {
      galeriasAtivas: null,
      armazenamentoGb: null,
      clientes: null,
      fotosPorGaleria: null,
    },
    recursos: {
      selecaoProva: true,
      comentarios: true,
      senhaGaleria: true,
      entregaFinal: true,
      envioEmail: true,
      brandingPersonalizado: true,
      heroEstudio: true,
      heroPremiumTech: true,
      notificacoesPush: true,
    },
  },
  essencial: {
    codigo: "essencial",
    nome: "Essencial",
    descricao: "Para fotógrafos que estão organizando e profissionalizando a entrega aos clientes.",
    precoMensalCentavos: 2990,
    limites: {
      galeriasAtivas: 10,
      armazenamentoGb: 20,
      clientes: 250,
      fotosPorGaleria: 1000,
    },
    recursos: {
      selecaoProva: true,
      comentarios: true,
      senhaGaleria: true,
      entregaFinal: true,
      envioEmail: true,
      brandingPersonalizado: true,
      heroEstudio: true,
      heroPremiumTech: false,
      notificacoesPush: true,
    },
  },
  profissional: {
    codigo: "profissional",
    nome: "Profissional",
    descricao: "Para fotógrafos com volume recorrente de trabalhos e maior necessidade de apresentação.",
    precoMensalCentavos: 5990,
    limites: {
      galeriasAtivas: 50,
      armazenamentoGb: 100,
      clientes: 2000,
      fotosPorGaleria: 3000,
    },
    recursos: {
      selecaoProva: true,
      comentarios: true,
      senhaGaleria: true,
      entregaFinal: true,
      envioEmail: true,
      brandingPersonalizado: true,
      heroEstudio: true,
      heroPremiumTech: true,
      notificacoesPush: true,
    },
  },
  studio: {
    codigo: "studio",
    nome: "Studio",
    descricao: "Para estúdios e operações com grande volume de clientes e galerias.",
    precoMensalCentavos: 11990,
    limites: {
      galeriasAtivas: null,
      armazenamentoGb: 500,
      clientes: null,
      fotosPorGaleria: 5000,
    },
    recursos: {
      selecaoProva: true,
      comentarios: true,
      senhaGaleria: true,
      entregaFinal: true,
      envioEmail: true,
      brandingPersonalizado: true,
      heroEstudio: true,
      heroPremiumTech: true,
      notificacoesPush: true,
    },
  },
};

export function planoFotura(codigo: string | null | undefined): PlanoFotura {
  if (codigo && codigo in PLANOS_FOTURA) return PLANOS_FOTURA[codigo as PlanoCodigo];
  return PLANOS_FOTURA.sem_plano;
}
