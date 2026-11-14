/** Métricas dos gráficos do painel: projetos e pastas são unidades distintas. */
export type UnidadeGrafico = "projetos" | "pastas";
export type EtapaPastaGrafico = "prova" | "selecao_finalizada" | "preparando_entrega" | "entrega";
export type ProjetoGrafico = { id: string; criadoEm: string | null; prova: boolean };
export type PastaGrafico = {
  id: string; projetoId: string | null; criadoEm: string | null;
  prova: boolean; etapa: EtapaPastaGrafico;
};
export type SelecaoGrafico = Record<string, { finalizada: boolean } | undefined>;
export type EstadoGrafico = "aguardando" | "selecao" | "preparando" | "entregue" | "andamento" | "sem_pastas";

const ETAPAS: { chave: EstadoGrafico; nome: string; cor: string }[] = [
  { chave: "aguardando", nome: "Aguardando cliente", cor: "#F97316" },
  { chave: "selecao", nome: "Seleção finalizada", cor: "#9b7cff" },
  { chave: "preparando", nome: "Preparando entrega", cor: "#3f6fff" },
  { chave: "entregue", nome: "Entregue", cor: "#53c98b" },
  { chave: "andamento", nome: "Em andamento", cor: "#409ec3" },
  { chave: "sem_pastas", nome: "Sem pastas", cor: "#a1a4b5" },
];

export function estadoPastaGrafico(pasta: PastaGrafico, selecoes: SelecaoGrafico): EstadoGrafico {
  if (pasta.etapa === "entrega") return "entregue";
  if (pasta.etapa === "preparando_entrega") return "preparando";
  if (pasta.etapa === "selecao_finalizada" || (pasta.prova && selecoes[pasta.id]?.finalizada)) return "selecao";
  return pasta.prova ? "aguardando" : "andamento";
}

export function estadoProjetoGrafico(
  projeto: ProjetoGrafico,
  pastasDoProjeto: PastaGrafico[],
  selecoes: SelecaoGrafico,
): EstadoGrafico {
  if (!pastasDoProjeto.length) return "sem_pastas";
  const estados = pastasDoProjeto.map(pasta => estadoPastaGrafico(pasta, selecoes));
  if (estados.every(etapa => etapa === "entregue")) return "entregue";
  if (estados.includes("preparando")) return "preparando";
  if (estados.includes("selecao")) return "selecao";
  if (estados.includes("aguardando") || projeto.prova) return "aguardando";
  return "andamento";
}

export function calcularGraficosDashboard(
  projetos: ProjetoGrafico[],
  pastas: PastaGrafico[],
  selecoes: SelecaoGrafico,
  unidade: UnidadeGrafico,
  agora = new Date(),
) {
  const agrupadas = new Map<string, PastaGrafico[]>();
  for (const pasta of pastas) {
    if (!pasta.projetoId) continue;
    const grupo = agrupadas.get(pasta.projetoId) ?? [];
    grupo.push(pasta);
    agrupadas.set(pasta.projetoId, grupo);
  }
  const itens = unidade === "projetos" ? projetos : pastas;
  const contagens: Record<EstadoGrafico, number> = {
    aguardando: 0, selecao: 0, preparando: 0, entregue: 0, andamento: 0, sem_pastas: 0,
  };
  if (unidade === "projetos") {
    for (const projeto of projetos) contagens[estadoProjetoGrafico(projeto, agrupadas.get(projeto.id) ?? [], selecoes)]++;
  } else {
    for (const pasta of pastas) contagens[estadoPastaGrafico(pasta, selecoes)]++;
  }
  const categorias = ETAPAS.filter(item => unidade === "projetos" || item.chave !== "sem_pastas")
    .map(item => ({ ...item, qtd: contagens[item.chave] }));
  const meses: { label: string; qtd: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mes = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const qtd = itens.filter(item => {
      if (!item.criadoEm) return false;
      const data = new Date(item.criadoEm);
      return !Number.isNaN(data.getTime()) &&
        data.getFullYear() === mes.getFullYear() && data.getMonth() === mes.getMonth();
    }).length;
    meses.push({ label: mes.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), qtd });
  }
  const inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth() - 5, 1).getTime();
  const ultimosSeisMeses = itens.filter(item =>
    item.criadoEm && !Number.isNaN(Date.parse(item.criadoEm)) &&
    new Date(item.criadoEm).getTime() >= inicioPeriodo &&
    new Date(item.criadoEm).getTime() <= agora.getTime()
  ).length;
  const total = itens.length;
  let percentual = 0;
  const fatias = categorias.filter(item => item.qtd > 0).map(item => {
    const inicio = percentual;
    percentual += (item.qtd / total) * 100;
    return `${item.cor} ${inicio}% ${percentual}%`;
  });
  return {
    meses, maximoMes: Math.max(1, ...meses.map(mes => mes.qtd)),
    ultimosSeisMeses, total, categorias,
    gradiente: fatias.length ? `conic-gradient(${fatias.join(",")})` : "#ece9f2",
  };
}
