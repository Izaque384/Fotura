export type PlanoCodigo = "sem_plano" | "gratis" | "legacy" | "essencial" | "profissional" | "studio";

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
    heroFotoGaleria: boolean;
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
      heroFotoGaleria: false,
      notificacoesPush: false,
    },
  },
  gratis: {
    codigo: "gratis",
    nome: "Grátis",
    descricao: "Para conhecer o Fotura, criar galerias reais e começar sem custo.",
    precoMensalCentavos: 0,
    limites: {
      galeriasAtivas: null,
      armazenamentoGb: 1,
      clientes: null,
      fotosPorGaleria: null,
    },
    recursos: {
      selecaoProva: true,
      comentarios: true,
      senhaGaleria: true,
      entregaFinal: true,
      envioEmail: false,
      brandingPersonalizado: true,
      heroEstudio: true,
      heroPremiumTech: false,
      heroFotoGaleria: false,
      notificacoesPush: true,
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
      heroFotoGaleria: true,
      notificacoesPush: true,
    },
  },
  essencial: {
    codigo: "essencial",
    nome: "Essencial",
    descricao: "Para fotógrafos que querem uma entrega profissional com baixo volume de armazenamento.",
    precoMensalCentavos: 1490,
    limites: {
      galeriasAtivas: null,
      armazenamentoGb: 10,
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
      heroPremiumTech: false,
      heroFotoGaleria: false,
      notificacoesPush: true,
    },
  },
  profissional: {
    codigo: "profissional",
    nome: "Profissional",
    descricao: "Para fotógrafos com rotina recorrente e uma experiência de apresentação mais avançada.",
    precoMensalCentavos: 2990,
    limites: {
      galeriasAtivas: null,
      armazenamentoGb: 50,
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
      heroFotoGaleria: true,
      notificacoesPush: true,
    },
  },
  studio: {
    codigo: "studio",
    nome: "Studio",
    descricao: "Para estúdios e operações com alto volume de armazenamento e entregas.",
    precoMensalCentavos: 5990,
    limites: {
      galeriasAtivas: null,
      armazenamentoGb: 100,
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
      heroFotoGaleria: true,
      notificacoesPush: true,
    },
  },
};

export function planoFotura(codigo: string | null | undefined): PlanoFotura {
  if (codigo && codigo in PLANOS_FOTURA) return PLANOS_FOTURA[codigo as PlanoCodigo];
  return PLANOS_FOTURA.sem_plano;
}
